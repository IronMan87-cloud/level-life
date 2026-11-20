import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fresh, day, shift } from '../app/model.js';

const dependency = process.env.LEVEL_PGLITE;
const { PGlite } = await import(dependency ? pathToFileURL(dependency + '/dist/index.js').href : '@electric-sql/pglite');
const { pgcrypto } = await import(dependency ? pathToFileURL(dependency + '/dist/contrib/pgcrypto.js').href : '@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
create role anon;
create role authenticated;
create schema auth;
create schema extensions;
create extension pgcrypto schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table public.level_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}', schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.level_snapshots enable row level security;
create policy existing_owner_policy on public.level_snapshots to authenticated
  using (auth.uid()=user_id) with check(auth.uid()=user_id);
grant select, insert, update, delete on public.level_snapshots to authenticated;
`);

const migration = await readFile(new URL('../supabase/migrations/20261120090509_level_workspace.sql',import.meta.url),'utf8');
await db.exec(migration.split('create extension if not exists pg_cron;')[0]);

const alice = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bob = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const today = day('UTC');
const yesterday = shift(today,-1);
const call = async (query,args = []) => (await db.query(query,args)).rows[0].result;
const role = async (role,owner = '') => {
  await db.exec('set role ' + role);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
};
await db.query('insert into auth.users values ($1),($2)',[alice,bob]);

await role('authenticated',alice);
const first = fresh('UTC');
Object.assign(first.settings,{nightly:true,autoMove:true,minutes:180});
first.tasks.push({ id:'long', title:'Сделать отчёт', minutes:90, date:yesterday, priority:'normal', history:[] });
first.goals.push({ id:'goal', title:'Написать книгу', deadline:yesterday, milestones:[] });
const save = (doc, row = {}) => call('select public.level_save($1,$2,$3) as result',[JSON.stringify(doc),row.updated_at ?? null,row.generation ?? null]);
const row = await save(first);
assert.equal(row.schema_version,2);
await assert.rejects(save(first),/Облачная версия изменилась/);
const token = await call('select public.level_agent_key(false) as result');
assert.match(token,/^[0-9a-f]{64}$/);
await assert.rejects(db.query('update public.level_snapshots set payload=\'{}\''),/permission denied/);

await role('authenticated',bob);
assert.equal(await call('select count(*)::int as result from public.level_snapshots'),0);
assert.equal(await call('select public.level_export() as result'),null);
const bobRow = await save(fresh('UTC'));
assert.notEqual(bobRow.generation,row.generation);
assert.equal(await call('select count(*)::int as result from public.level_snapshots where user_id=$1',[alice]),0);

const ingest = (key = token) => call('select public.level_ingest($1,$2,$3,$4,$5,$6) as result',[key,eventId,'Нужен новый план',yesterday,'Поговорить с командой',20]);
await role('anon');
await assert.rejects(db.query('select public.level_export()'),/permission denied/);
await assert.rejects(ingest('0'.repeat(64)),/Недействительный ключ/);
assert.equal((await ingest()).duplicate,false);
assert.equal((await ingest()).duplicate,true);

await db.exec('reset role');
await call('select level_private.run_nightly() as result');
await call('select level_private.run_nightly() as result');
await role('authenticated',alice);
const reviewed = await call('select payload as result from public.level_snapshots');
assert.equal(reviewed.entries.length,1);
assert.equal(reviewed.reviews.length,1);
assert.equal(reviewed.tasks[0].date,today);
assert.equal(reviewed.reviews[0].suggestions.length,3);
assert.equal(reviewed.reviews[0].suggestions[0].status,'automatic');
assert.equal(reviewed.reviews[0].suggestions[1].status,'pending');
assert.equal(reviewed.reviews[0].suggestions[2].risk,'medium');
assert.equal(reviewed.ledger.length,0);
assert.equal((await call('select public.level_review($1,$2) as result',[yesterday,row.generation])).payload.reviews.length,1);
await assert.rejects(save(first,row),/Облачная версия изменилась/);
const archive = await call('select public.level_export() as result');
assert.equal(archive.owner,alice);
assert.deepEqual(JSON.parse(archive.snapshot_text),reviewed);
const reset = (digest,phrase) => call('select public.level_reset($1,$2,$3) as result',[archive.revision,digest,phrase]);
await assert.rejects(reset(archive.sha256,'wrong'),/Подтвердите/);
await assert.rejects(reset('wrong','СБРОСИТЬ'),/Снимок изменился/);
const cleared = await reset(archive.sha256,'СБРОСИТЬ');
assert.notEqual(cleared.generation,row.generation);
assert.deepEqual(cleared.payload,{version:2});
await assert.rejects(save(first,row),/Облачная версия изменилась/);
await role('anon');
await assert.rejects(ingest(),/Недействительный ключ/);
await role('authenticated',bob);
assert.equal(await call('select generation as result from public.level_snapshots'),bobRow.generation);
await db.close();
console.log('PostgreSQL: RLS, RPC ownership, revision conflicts, scoped ingestion, nightly rules, export and reset passed');
