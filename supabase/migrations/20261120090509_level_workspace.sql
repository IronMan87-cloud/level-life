create schema if not exists level_private;
revoke all on schema level_private from public;
grant usage on schema level_private to anon, authenticated;

alter table public.level_snapshots add column generation uuid not null default gen_random_uuid();
revoke all on public.level_snapshots from public, anon, authenticated;
grant select (user_id, payload, schema_version, updated_at, generation) on public.level_snapshots to authenticated;

create table level_private.agent_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  digest bytea not null unique
);
alter table level_private.agent_keys enable row level security;

create function level_private.owner_id() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Войдите в LEVEL.' using errcode = '42501'; end if;
  return auth.uid();
end;
$$;

create function level_private.snapshot(s public.level_snapshots) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('payload', s.payload, 'generation', s.generation,
    'updated_at', s.updated_at, 'schema_version', s.schema_version);
$$;

create function level_private.save(document jsonb, revision timestamptz, epoch uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := level_private.owner_id();
  current_row public.level_snapshots;
  collection text;
begin
  if document is null or document->>'version' is distinct from '2' or octet_length(document::text) > 4500000
      or not exists (select from pg_catalog.pg_timezone_names where name = document#>>'{settings,zone}')
      or document#>>'{settings,minutes}' is null
      or document#>>'{settings,minutes}' !~ '^([0-9]{1,3}|1[0-4][0-9]{2})$'
      or (document#>>'{settings,minutes}')::integer not between 0 and 1440 then
    raise exception 'Некорректный формат или размер данных LEVEL.' using errcode = '22023';
  end if;
  foreach collection in array array['tasks','goals','skills','entries','reviews','pauseDates','ledger','materials','habits','projects','health','transactions','rewards']
  loop
    if jsonb_typeof(document->collection) is distinct from 'array' then
      raise exception 'Некорректная коллекция LEVEL.' using errcode = '22023';
    end if;
  end loop;
  if revision is null and epoch is null then
    insert into public.level_snapshots (user_id, payload, schema_version)
    values (owner, document, 2) on conflict do nothing returning * into current_row;
  else
    update public.level_snapshots set payload = document, schema_version = 2,
      updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
      where user_id = owner and updated_at = revision and generation = epoch returning * into current_row;
  end if;
  if current_row.user_id is null then
    raise exception 'Облачная версия изменилась. Скачайте черновик или обновите данные.' using errcode = '40001';
  end if;
  return level_private.snapshot(current_row);
end;
$$;

create function level_private.export_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := level_private.owner_id();
  output jsonb;
begin
  select jsonb_build_object('snapshot_text', payload::text, 'revision', updated_at,
    'sha256', encode(extensions.digest(payload::text, 'sha256'), 'hex'), 'owner', user_id)
  into output from public.level_snapshots where user_id = owner;
  return output;
end;
$$;

create function level_private.reset_account(owner uuid, revision timestamptz, digest text) returns jsonb
language plpgsql set search_path = '' as $$
declare current_row public.level_snapshots;
begin
  update public.level_snapshots set payload = '{"version":2}', schema_version = 2,
    generation = gen_random_uuid(), updated_at = greatest(clock_timestamp(), updated_at + interval '1 microsecond')
    where user_id = owner and updated_at = revision
      and encode(extensions.digest(payload::text, 'sha256'), 'hex') = digest
    returning * into current_row;
  if current_row.user_id is null then
    raise exception 'Снимок изменился. Скачайте свежую копию.' using errcode = '40001';
  end if;
  delete from level_private.agent_keys where user_id = owner;
  return level_private.snapshot(current_row);
end;
$$;

create function level_private.reset_data(revision timestamptz, digest text, phrase text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if phrase is distinct from 'СБРОСИТЬ' then raise exception 'Подтвердите сброс.' using errcode = '22023'; end if;
  return level_private.reset_account(level_private.owner_id(), revision, digest);
end;
$$;

create function level_private.agent_key(revoke_key boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := level_private.owner_id();
  secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform 1 from public.level_snapshots where user_id = owner for update;
  if revoke_key then
    delete from level_private.agent_keys where user_id = owner;
    return null;
  end if;
  if not exists (select from public.level_snapshots where user_id = owner and schema_version = 2 and payload ? 'settings') then
    raise exception 'Сначала сохраните настройки LEVEL.';
  end if;
  insert into level_private.agent_keys (user_id, digest) values (owner, extensions.digest(secret, 'sha256'))
    on conflict (user_id) do update set digest = excluded.digest;
  return secret;
end;
$$;

create function level_private.ingest(token text, event_id uuid, body text, report_day date, next_action text, minutes integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  current_row public.level_snapshots;
  local_day date;
  context jsonb;
begin
  if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Недействительный ключ.' using errcode = '42501'; end if;
  select user_id into owner from level_private.agent_keys where digest = extensions.digest(token, 'sha256');
  if owner is null then raise exception 'Недействительный ключ.' using errcode = '42501'; end if;
  select * into current_row from public.level_snapshots where user_id = owner and schema_version = 2 for update;
  if not exists (select from level_private.agent_keys where user_id = owner and digest = extensions.digest(token, 'sha256'))
      or current_row.user_id is null then
    raise exception 'Недействительный ключ.' using errcode = '42501';
  end if;
  local_day := (now() at time zone (current_row.payload#>>'{settings,zone}'))::date;
  if event_id is null or body is null or char_length(trim(body)) not between 1 and 12000
    or char_length(coalesce(next_action,'')) > 180 or minutes is null or minutes not between 5 and 720
    or coalesce(report_day,local_day) not between local_day - 30 and local_day then
    raise exception 'Проверьте текст, дату и длительность отчёта.' using errcode = '22023';
  end if;
  if exists (select from jsonb_array_elements(current_row.payload->'entries') e where e->>'id'=event_id::text) then
    return jsonb_build_object('id',event_id,'duplicate',true);
  end if;
  context := jsonb_build_object('id',event_id,'date',coalesce(report_day,local_day),
    'text',trim(body),'action',trim(coalesce(next_action,'')),'minutes',minutes,'source','agent');
  if octet_length(current_row.payload::text) + octet_length(context::text) > 4450000 then
    raise exception 'Превышен размер хранилища LEVEL.' using errcode = '22023';
  end if;
  update public.level_snapshots set payload=jsonb_set(payload,'{entries}',(payload->'entries') || context),
    updated_at=greatest(clock_timestamp(), updated_at + interval '1 microsecond') where user_id=owner;
  return jsonb_build_object('id',event_id,'duplicate',false);
end;
$$;

create function level_private.window_minutes(start_time text, end_time text) returns integer
language sql immutable set search_path = '' as $$
  select case when start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then (1440 + (extract(epoch from (end_time::time - start_time::time)) / 60)::integer) % 1440 else 0 end;
$$;

create function level_private.build_review(owner uuid, context_day date, epoch uuid, automatic_run boolean) returns jsonb
language plpgsql set search_path = '' as $$
declare
  current_row public.level_snapshots;
  doc jsonb;
  config jsonb;
  local_day date;
  plan_day date := context_day + 1;
  capacity integer;
  reserved integer;
  initial_load integer;
  completed integer;
  pending_count integer;
  entry_count integer;
  changes jsonb := '[]';
  suggested jsonb;
  report jsonb;
  item jsonb;
  position integer;
  minutes integer;
  risk text;
  auto_apply boolean;
begin
  select * into current_row from public.level_snapshots where user_id=owner and schema_version=2 for update;
  if current_row.user_id is null or not current_row.payload ? 'settings' or current_row.generation is distinct from epoch then
    raise exception 'Сначала синхронизируйте настройки LEVEL.' using errcode = '40001';
  end if;
  doc := current_row.payload;
  config := doc->'settings';
  local_day := (now() at time zone (config->>'zone'))::date;
  if context_day is null or context_day not between local_day-30 and local_day then
    raise exception 'Выберите день в пределах последних 30 дней.' using errcode = '22023';
  end if;
  if automatic_run and (config->>'nightly' is distinct from 'true' or context_day <> local_day - 1) then
    return null;
  end if;
  if exists (select from jsonb_array_elements(doc->'reviews') r where r->>'date'=context_day::text) then
    return level_private.snapshot(current_row);
  end if;
  capacity := case when (doc->'pauseDates') ? plan_day::text then 0 else least(
    (config->>'minutes')::integer, greatest(0, 1440
      - level_private.window_minutes(config->>'workStart',config->>'workEnd')
      - level_private.window_minutes(config->>'sleepStart',config->>'sleepEnd'))) end;
  select coalesce(sum((t->>'minutes')::integer) filter (where t->>'date'=plan_day::text and t->>'done' is distinct from 'true'),0),
    count(*) filter (where t->>'completedOn'=context_day::text),
    count(*) filter (where t->>'date' between '1900-01-01' and context_day::text and t->>'done' is distinct from 'true')
  into initial_load, completed, pending_count from jsonb_array_elements(doc->'tasks') t;
  select count(*) into entry_count from jsonb_array_elements(doc->'entries') e where e->>'date'=context_day::text;
  reserved := initial_load;
  for item, position in
    select t, (n-1)::integer from jsonb_array_elements(doc->'tasks') with ordinality a(t,n)
    where t->>'done' is distinct from 'true' and t->>'date' between '1900-01-01' and context_day::text
    order by case when t->>'priority'='high' then 0 else 1 end, n limit 20
  loop
    minutes := (item->>'minutes')::integer;
    if minutes is null or minutes < 1 or reserved + minutes > capacity then continue; end if;
    reserved := reserved + minutes;
    risk := case when item->>'priority'='high' then 'medium' else 'low' end;
    auto_apply := risk='low' and config->>'autoMove'='true';
    suggested := jsonb_build_object('id',gen_random_uuid(),'type','move','risk',risk,'taskId',item->>'id',
      'from',item->>'date','to',plan_day,'title',item->>'title',
      'reason','Задание открыто и помещается в доступное время.',
      'status',case when auto_apply then 'automatic' else 'pending' end);
    if auto_apply then
      suggested := suggested || jsonb_build_object('decidedOn',local_day);
      item := item || jsonb_build_object('date',plan_day,'history',coalesce(item->'history','[]') ||
        jsonb_build_object('type','move','date',local_day,'previous',item->>'date','reason',suggested->>'reason'));
      doc := jsonb_set(doc,array['tasks',position::text],item);
    end if;
    changes := changes || suggested;
  end loop;
  for item in select e from jsonb_array_elements(doc->'entries') e
    where e->>'date'=context_day::text and nullif(e->>'action','') is not null limit 30
  loop
    minutes := (item->>'minutes')::integer;
    if minutes is null or minutes < 1 or reserved+minutes > capacity
      or exists (select from jsonb_array_elements(doc->'tasks') t where lower(t->>'title')=lower(item->>'action'))
      or exists (select from jsonb_array_elements(changes) s where s->>'type'='add' and lower(s->>'title')=lower(item->>'action')) then continue; end if;
    reserved := reserved+minutes;
    changes := changes || jsonb_build_object('id',gen_random_uuid(),'type','add','risk','low','to',plan_day,
      'title',item->>'action','minutes',minutes,'contextId',item->>'id','status','pending',
      'reason','Следующий шаг указан в записи дневника.');
  end loop;
  for item in select g from jsonb_array_elements(doc->'goals') g
    where g->>'deadline' between '1900-01-01' and context_day::text
      and (jsonb_array_length(g->'milestones')=0 or exists
        (select from jsonb_array_elements(g->'milestones') m where m->>'done' is distinct from 'true'))
    limit 10
  loop
    changes := changes || jsonb_build_object('id',gen_random_uuid(),'type','goal','risk','medium','from',item->>'deadline',
      'to',plan_day+6,'title',item->>'title','goalId',item->>'id','status','pending',
      'reason','Срок цели истёк. Проверьте, нужен ли дополнительный срок.');
  end loop;
  report := jsonb_build_object('date',context_day,'next',plan_day,'engine','rules','budget',capacity,'load',initial_load,
    'completed',completed,'pending',pending_count,'entries',entry_count,'suggestions',changes);
  doc := jsonb_set(doc,'{reviews}',report || (doc->'reviews'));
  update public.level_snapshots set payload=doc, updated_at=greatest(clock_timestamp(),updated_at + interval '1 microsecond')
    where user_id=owner returning * into current_row;
  return level_private.snapshot(current_row);
end;
$$;

create function level_private.review(context_day date, epoch uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select level_private.build_review(level_private.owner_id(),context_day,epoch,false);
$$;

create function level_private.run_nightly() returns void
language plpgsql set search_path = '' as $$
declare candidate record;
begin
  for candidate in
    select s.user_id,s.generation,((now() at time zone z.name)::date - 1) as context_day
    from public.level_snapshots s
    join pg_catalog.pg_timezone_names z on z.name=s.payload#>>'{settings,zone}'
    where s.schema_version=2 and s.payload#>>'{settings,nightly}'='true'
      and not exists (select from jsonb_array_elements(s.payload->'reviews') r
        where r->>'date'=((now() at time zone z.name)::date - 1)::text)
    order by s.user_id limit 200
  loop
    begin
      perform level_private.build_review(candidate.user_id,candidate.context_day,candidate.generation,true);
    exception when others then
      raise warning 'LEVEL nightly review failed [%]',sqlstate;
    end;
  end loop;
end;
$$;

create function public.level_save(document jsonb, revision timestamptz, epoch uuid) returns jsonb
language sql set search_path = '' as $$ select level_private.save(document,revision,epoch) $$;
create function public.level_export() returns jsonb
language sql set search_path = '' as $$ select level_private.export_data() $$;
create function public.level_reset(revision timestamptz,digest text,phrase text) returns jsonb
language sql set search_path = '' as $$ select level_private.reset_data(revision,digest,phrase) $$;
create function public.level_agent_key(revoke_key boolean) returns text
language sql set search_path = '' as $$ select level_private.agent_key(revoke_key) $$;
create function public.level_ingest(token text,event_id uuid,body text,report_day date,next_action text,minutes integer) returns jsonb
language sql set search_path = '' as $$ select level_private.ingest(token,event_id,body,report_day,next_action,minutes) $$;
create function public.level_review(context_day date,epoch uuid) returns jsonb
language sql set search_path = '' as $$ select level_private.review(context_day,epoch) $$;

revoke execute on all functions in schema level_private from public, anon, authenticated;
grant execute on function level_private.save(jsonb,timestamptz,uuid), level_private.export_data(),
  level_private.reset_data(timestamptz,text,text), level_private.agent_key(boolean), level_private.review(date,uuid) to authenticated;
grant execute on function level_private.ingest(text,uuid,text,date,text,integer) to anon, authenticated;

revoke execute on function public.level_save(jsonb,timestamptz,uuid), public.level_export(),
  public.level_reset(timestamptz,text,text), public.level_agent_key(boolean), public.level_review(date,uuid),
  public.level_ingest(text,uuid,text,date,text,integer) from public, anon, authenticated;
grant execute on function public.level_save(jsonb,timestamptz,uuid), public.level_export(),
  public.level_reset(timestamptz,text,text), public.level_agent_key(boolean), public.level_review(date,uuid) to authenticated;
grant execute on function public.level_ingest(text,uuid,text,date,text,integer) to anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('level-nightly-review', '*/10 * * * *', 'select level_private.run_nightly()');
