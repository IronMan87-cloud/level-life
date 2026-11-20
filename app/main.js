import { fresh, migrate, uid, day, shift, award, complete, checkAnswer, replaceTask, safeUrl, reviewDay, applySuggestion } from './model.js';
import { Cloud, project, publishable, checksum, deviceArchive, clearDeviceArchive } from './cloud.js';
import { esc, attr, icon, button, iconButton, field, input, area, select, dateLabel } from './ui.js';
import { pages, shell, home, plan, growth, goals, profile, materialContent } from './views.js';

const KEY = 'level-workspace-v2';
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const notice = document.querySelector('#toast');
const client = window.supabase?.createClient(project, publishable);
const cloud = client ? new Cloud(client) : null;
const panes = { plan: 'calendar', growth: 'skills', goals: 'goals', profile: 'stats' };
const pageName = () => pages.find(([id]) => '#' + id === location.hash)?.[0] || 'home';
const text = (data, name) => String(data.get(name) ?? '').trim();
const int = (data, name) => Number(data.get(name));
const titleInput = (name = 'title', value = '', required = true) => input(name, value, 'maxlength="180"' + (required ? ' required' : ''));
const numberInput = (name, value, min, max) => input(name, value, `type="number" min="${min}" max="${max}" required`);
const options = values => values.map(value => [value, value]);
const fieldGrid = (...controls) => `<div class="form-grid">${controls.join('')}</div>`;
const related = (rows, placeholder) => [['', placeholder], ...rows.map(row => [row.id, row.title])];
let state = fresh();
let selected;
let account;
let remote;
let syncing = false;
let readSucceeded = true;
let failedDraft;
let message = '';
let toastTimer;
let authInitialized = false;
let authRequest = 0;
let submit;
let returnFocus;
let booting = !!client;
let needsPassword = new URLSearchParams(location.search).has('auth_setup') || location.hash.includes('type=recovery');
const today = () => day(state.settings.zone);

function guest() {
  try {
    return migrate(JSON.parse(localStorage.getItem(KEY) || JSON.stringify(fresh())));
  } catch {
    return fresh();
  }
}

function render() {
  if (booting) {
    app.innerHTML = '<main aria-busy="true"><p>Загружаем LEVEL…</p></main>';
    return;
  }
  const active = pageName();
  const date = today();
  const activeViews = {
    home: () => home(state, date),
    plan: () => plan(state, date, selected || date, panes.plan),
    growth: () => growth(state, panes.growth),
    goals: () => goals(state, panes.goals),
    profile: () => profile(state, date, panes.profile, account),
  };
  document.documentElement.dataset.theme = state.settings.theme;
  document.querySelector('meta[name=theme-color]').content = state.settings.theme === 'light' ? '#edf3fa' : '#0b111c';
  app.innerHTML = shell(active, state, date, message, account, activeViews[active]());
}

function toast(message) {
  clearTimeout(toastTimer);
  notice.textContent = message;
  toastTimer = setTimeout(() => { notice.textContent = ''; }, 4300);
}

function go(page, pane) {
  if (pane) panes[page] = pane;
  if (location.hash !== '#' + page) location.hash = page;
  else render();
}

function modal(title, contents, onSubmit, label = 'Сохранить', style = 'primary') {
  submit = onSubmit;
  if (!dialog.open) returnFocus = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${iconButton('close','Закрыть','close')}</div>
    <div class="dialog-body">${onSubmit ? `<form>${contents}<p class="form-error" role="alert"></p>
       <div class="form-actions">${button('close','Отмена','','quiet')}<button type="submit" class="button ${style}">${esc(label)}</button></div></form>` : contents}</div>`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('form input:not([type=hidden]), form textarea, .dialog-head button')?.focus({ preventScroll: true });
}

function download(document, name = 'level-backup.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }));
  const link = Object.assign(window.document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function useRow(row) {
  remote = row;
  state = row ? migrate(row.payload) : fresh();
}

async function setAccount(user) {
  if (authInitialized && (account?.id || '') === (user?.id || '')) return;
  authInitialized = true;
  const request = ++authRequest;
  account = user;
  failedDraft = null;
  remote = undefined;
  message = '';
  readSucceeded = !user;
  state = user ? fresh() : guest();
  if (user) {
    try {
      const row = await cloud.read();
      if (request !== authRequest) return;
      useRow(row);
      readSucceeded = true;
      if (row?.schema_version === 1) message = 'Данные предыдущей версии открыты. Следующее сохранение обновит формат.';
    } catch {
      if (request !== authRequest) return;
      message = 'Облачные данные временно недоступны.';
    }
  }
  booting = false;
  render();
  if (user && needsPassword) passwordForm();
}

async function commit(mutator, confirmation = '') {
  if (syncing) throw new Error('Дождитесь завершения сохранения.');
  if (account && (!readSucceeded || failedDraft)) throw new Error('Сначала проверьте состояние синхронизации.');
  const next = structuredClone(state);
  const effect = await mutator(next);
  if (account) {
    const request = authRequest;
    syncing = true;
    try {
      const row = await cloud.save(next, remote);
      if (request !== authRequest) return false;
      useRow(row);
    } catch (error) {
      if (request === authRequest) {
        failedDraft = { state: next, remote };
        message = 'Изменения ожидают синхронизации.';
        render();
      }
      throw new Error(error.cause?.code === '40001' ? error.message : 'Сохранение не завершилось. Проверьте синхронизацию.');
    } finally {
      syncing = false;
    }
  } else {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error('На устройстве не удалось сохранить изменения. Проверьте свободное место.');
    }
    state = next;
  }
  message = '';
  render();
  if (typeof effect === 'number' && effect > 0) toast('+' + effect + ' XP');
  else if (confirmation) toast(confirmation);
  return true;
}

async function sync() {
  if (!account || syncing) return;
  const request = authRequest;
  syncing = true;
  try {
    const row = await cloud.read();
    if (request !== authRequest) return;
    if (failedDraft) {
      const draft = failedDraft;
      if (row?.updated_at !== draft.remote?.updated_at || row?.generation !== draft.remote?.generation) {
        if (row?.generation !== draft.remote?.generation && draft.remote?.generation) {
          failedDraft = null;
          useRow(row);
          message = '';
          readSucceeded = true;
          if (dialog.open) dialog.close();
          render();
          toast('Аккаунт был сброшен. Открыта актуальная версия.');
          return;
        }
        modal('Облачная версия изменилась', '<p>Скачайте черновик, если хотите сохранить свои изменения для проверки. Затем откройте актуальную версию.</p>' +
          `<div class="button-row">${button('draft-export','Скачать черновик','cloud','secondary')}${button('load-remote','Открыть облачную версию','','primary')}</div>`);
        return;
      }
      const updated = await cloud.save(draft.state, draft.remote);
      if (request !== authRequest) return;
      useRow(updated);
      failedDraft = null;
    } else if (row?.updated_at !== remote?.updated_at || !readSucceeded) {
      useRow(row);
    }
    readSucceeded = true;
    message = '';
    render();
  } catch {
    if (request === authRequest) {
      message = 'Синхронизация пока недоступна.';
      render();
    }
  } finally {
    syncing = false;
  }
}

function settingsFields(config, full = true) {
  const zoneChoices = new Set([config.zone, 'UTC', ...(Intl.supportedValuesOf?.('timeZone') || [])]);
  return fieldGrid(
    field('Доступно минут в день', numberInput('minutes', config.minutes, 0, 1440)),
    field('Интенсивность', select('intensity', options(['Мягкая','Умеренная','Высокая']), config.intensity)),
    field('Подход к заданиям', select('approach', options(['Гибкий','По расписанию','По приоритету']), config.approach)),
    field('Подтверждение результата', select('evidence', [['note','Краткий отчёт'],['check','Отметка выполнения']], config.evidence)),
    field('Часовой пояс', select('zone', [...zoneChoices].sort().map(zone => [zone,zone]), config.zone)),
    field('Напоминание об итогах дня', select('notifications', [['off','Выключено'],['in-app','В приложении']], config.notifications)),
  ) + field('Описание графика работы или учёбы', input('schedule', config.schedule, 'maxlength="220"')) +
    fieldGrid(...[['workStart','Начало работы'],['workEnd','Конец работы'],['sleepStart','Начало сна'],['sleepEnd','Конец сна']]
      .map(([name,label]) => field(label,input(name,config[name],'type="time"')))) +
    (full ? `<label class="checkbox"><input type="checkbox" name="nightly" ${config.nightly ? 'checked' : ''} ${account ? '' : 'disabled'}> Ночной обзор в облаке</label>
      <label class="checkbox"><input type="checkbox" name="autoMove" ${config.autoMove ? 'checked' : ''}> Разрешить перенос обычных задач на следующий день</label>` : '');
}

function preferences(data) {
  return {
    minutes: int(data, 'minutes'), intensity: text(data,'intensity'), approach: text(data,'approach'), evidence: text(data,'evidence'),
    zone: text(data,'zone'), notifications: text(data,'notifications'), schedule: text(data,'schedule'),
    workStart: text(data,'workStart'), workEnd: text(data,'workEnd'), sleepStart: text(data,'sleepStart'), sleepEnd: text(data,'sleepEnd'),
  };
}

function onboarding(step = 0, values = {}) {
  if (step === 0) {
    modal('Что для вас важно?', '<p>Выберите направления, с которых хотите начать. Позже их можно изменить.</p>' +
      field('Как к вам обращаться', input('name', values.name, 'maxlength="80" autocomplete="nickname"')) +
      ['Здоровье','Карьера','Обучение','Творчество','Отношения','Финансы','Личные проекты'].map(label =>
       `<label class="checkbox"><input type="checkbox" name="direction" value="${label}" ${values.directions?.includes(label) ? 'checked' : ''}> ${label}</label>`).join('') +
      button('skip-setup','Начать без настройки','','quiet'), data => {
        onboarding(1, { name: text(data,'name'), directions: data.getAll('direction') });
        return false;
      }, 'Продолжить');
  } else {
    modal('Ваш темп', '<p>Определите, сколько времени хотите уделять развитию. Цель и навык можно добавить позже.</p>' +
      settingsFields(state.settings, false) +
      field('Первая цель', titleInput('goal','',false)) + field('Первый навык', titleInput('skill','',false)),
      async data => {
        await commit(next => {
          next.settings = { ...next.settings, ...values, ...preferences(data) };
          next.setup = true;
          if (text(data,'goal')) next.goals.push({ id:uid(), title:text(data,'goal'), description:'', deadline:'', milestones:[] });
          if (text(data,'skill')) next.skills.push({ id:uid(), title:text(data,'skill'), category:'', description:'', metric:'', unit:'', target:null, direction:'higher', results:[] });
        }, 'Настройка завершена');
      }, 'Начать');
  }
}

function editSettings() {
  modal('Настройки развития', field('Имя',input('name',state.settings.name,'maxlength="80" autocomplete="nickname"')) +
    field('Направления через запятую',input('directions',state.settings.directions.join(', '),'maxlength="220"')) +
    settingsFields(state.settings), data => commit(next => {
      next.settings = { ...next.settings, ...preferences(data), name:text(data,'name'),
        directions:text(data,'directions').split(',').map(x => x.trim()).filter(Boolean),
        nightly: !!account && data.has('nightly'), autoMove: data.has('autoMove') };
    }, 'Настройки сохранены'));
}

function goalForm(id) {
  const goal = state.goals.find(g => g.id === id);
  modal(goal ? 'Редактировать цель' : 'Новая цель',
    field('Название',titleInput('title',goal?.title)) + field('Как выглядит результат',area('description',goal?.description)) +
    field('Срок',input('deadline',goal?.deadline,'type="date"')) +
    field('Этапы, по одному на строку',area('milestones',goal?.milestones.map(m => m.title).join('\n'))),
    data => commit(next => {
      const milestoneTitles = [...new Set(text(data,'milestones').split('\n').map(x => x.trim()).filter(Boolean))];
      if (!text(data,'title')) throw new Error('Укажите название.');
      if (milestoneTitles.length > 80 || milestoneTitles.some(title => title.length > 180)) throw new Error('Укажите до 80 этапов по 180 символов.');
      const updated = { id:goal?.id || uid(), title:text(data,'title'), description:text(data,'description'),
        deadline:text(data,'deadline'), milestones:milestoneTitles.map(title => goal?.milestones.find(m => m.title === title) || { id:uid(), title, done:false }) };
      if (goal) {
        Object.assign(next.goals.find(g => g.id === id), updated);
        for (const task of next.tasks.filter(t => t.goalId === id)) {
          if (!updated.milestones.some(m => m.id === task.milestoneId)) task.milestoneId = '';
        }
      } else next.goals.push(updated);
    }, 'Цель сохранена'));
}

function skillForm(id) {
  const skill = state.skills.find(s => s.id === id);
  modal(skill ? 'Редактировать навык' : 'Новый навык',
    field('Название',titleInput('title',skill?.title)) + field('Категория',input('category',skill?.category,'maxlength="80"')) +
    field('Описание',area('description',skill?.description)) +
    '<p>Добавьте измеримый норматив, чтобы подтвердить компетентность.</p>' +
    fieldGrid(field('Метрика',input('metric',skill?.metric,'maxlength="120"')),field('Единица',input('unit',skill?.unit,'maxlength="40"'))) +
    fieldGrid(field('Целевое значение',input('target',skill?.target,'type="number" step="any"')),field('Условие',select('direction',[['higher','Не меньше цели'],['lower','Не больше цели']],skill?.direction || 'higher'))),
    data => commit(next => {
      const target = text(data,'target') === '' ? null : int(data,'target');
      if (!text(data,'title')) throw new Error('Укажите название.');
      if (target !== null && (!Number.isFinite(target) || !text(data,'metric') || !text(data,'unit'))) throw new Error('Укажите метрику, единицу и число.');
      const updated = { id:id || uid(), title:text(data,'title'), category:text(data,'category'), description:text(data,'description'),
        metric:text(data,'metric'), unit:text(data,'unit'), target, direction:text(data,'direction'), results:skill?.results || [] };
      if (skill) Object.assign(next.skills.find(s => s.id === id),updated);
      else next.skills.push(updated);
    }, 'Навык сохранён'));
}

function skillInfo(skill) {
  const tasks = state.tasks.filter(t => t.skillId === skill.id);
  const history = state.ledger.filter(event => event.skillId === skill.id);
  modal(skill.title, `<p>${esc(skill.description)}</p><p>${skill.target == null ? 'Норматив не задан.' : esc(skill.metric + ' · ' + (skill.direction === 'lower' ? '≤ ' : '≥ ') + skill.target + ' ' + skill.unit)}</p>
    <div class="button-row">${button('skill','Настроить норматив','edit','secondary',skill.id)}${button('skill-task','Добавить задание','plus','quiet',skill.id)}</div>
    ${tasks.length ? '<h3>Задания</h3>' + tasks.map(t => button('task-info',t.title,t.kind === 'study' ? 'book' : 'flag','quiet',t.id)).join('') : ''}
    ${history.length ? '<h3>История XP</h3>' + history.map(e => `<p>${dateLabel(e.date)} · +${esc(e.xp)} XP</p>`).join('') : ''}
    ${skill.results?.length ? '<h3>Замеры</h3>' + skill.results.map(r => `<div class="entry"><strong>${esc(r.metric || r.title)} · ${esc(r.value)} ${esc(r.unit)}</strong><p>${esc(r.evidence || r.desc)}</p><small>${dateLabel(r.date)} · ${r.status === 'approved' ? 'Подтверждено пользователем' : 'Ожидает проверки'}</small>
      ${r.status === 'approved' ? '' : button('approve-proof','Подтвердить результат','check','secondary',skill.id + '/' + r.id)}</div>`).join('') : ''}`);
}

function proofForm(skill) {
  if (skill.target == null) {
    modal('Измеримый результат','<p>Сначала задайте норматив и единицу измерения.</p>' + button('skill','Настроить норматив','edit','primary',skill.id));
    return;
  }
  modal('Замер навыка', `<p>${esc(skill.metric + ' · ' + skill.unit)}</p>` +
    field('Результат',input('value','','type="number" step="any" required')) + field('Как получен результат',area('evidence','','required')),
    data => commit(next => {
      if (!text(data,'evidence') || !Number.isFinite(int(data,'value'))) throw new Error('Опишите доказательство и укажите число.');
      next.skills.find(s => s.id === skill.id).results.push({ id:uid(), metric:skill.metric, unit:skill.unit,
        value:int(data,'value'), evidence:text(data,'evidence'), date:today(), status:'pending' });
    }, 'Замер сохранён'));
}

function taskForm({ id, goalId = '', skillId = '', date = selected || today() } = {}) {
  const task = state.tasks.find(t => t.id === id);
  const editing = !!task;
  const started = task?.studied || task?.done;
  const links = [['', 'Без этапа'], ...state.goals.flatMap(g => g.milestones.map(m => [g.id + '/' + m.id, g.title + ' · ' + m.title]))];
  const learning = `<fieldset id="learning-fields" ${task?.kind === 'study' ? '' : 'hidden'}><legend>Обучение</legend>
    ${field('Учебный материал',select('materialId',related(state.materials,'Выберите материал'),task?.materialId))}
    ${fieldGrid(field('XP за изучение',numberInput('studyXP',task?.studyXP ?? 10,0,100)),field('XP за проверку',numberInput('checkXP',task?.checkXP ?? 15,0,100)))}
    ${field('Контрольный вопрос',input('question',task?.question,'maxlength="180"'))}
    ${field('Точный ответ',input('answer',task?.answer,'maxlength="180"'))}</fieldset>`;
  modal(editing ? 'Параметры задания' : 'Новое задание',
    (editing ? '' : field('Название',titleInput())) +
    field('Описание или цель обучения',area('description',task?.description)) +
    fieldGrid(field('Дата',input('date',task?.date || date,'type="date" required')),field('Время',input('time',task?.time,'type="time"')),
      field('Длительность, мин',numberInput('minutes',task?.minutes ?? 20,1,1440)),
      field('Сложность',select('difficulty',[['light','Лёгкая'],['normal','Средняя'],['hard','Сложная']],task?.difficulty || 'normal')),
      field('Приоритет',select('priority',[['normal','Обычный'],['high','Высокий']],task?.priority || 'normal')),
      field('XP за практику',numberInput('xp',task?.xp ?? 20,0,200))) +
    fieldGrid(field('Цель',select('goalId',related(state.goals,'Без цели'),task?.goalId || goalId)),
      field('Этап цели',select('milestone',links,task?.milestoneId ? task.goalId + '/' + task.milestoneId : '')),
      field('Навык',select('skillId',related(state.skills,'Без навыка'),task?.skillId || skillId))) +
    field('Критерий выполнения',area('criterion',task?.criterion,'required')) +
    (started ? '' : field('Тип',select('kind',[['practice','Практика'],['study','Обучение с материалом']],task?.kind || 'practice')) + learning),
    data => commit(next => {
      const kind = started ? task.kind : text(data,'kind');
      const materialId = started ? task.materialId : text(data,'materialId');
      if (kind === 'study' && !next.materials.some(m => m.id === materialId)) throw new Error('Добавьте материал в библиотеку и выберите его здесь.');
      if (!started && kind === 'study' && (!text(data,'question') || !text(data,'answer') || !text(data,'description'))) throw new Error('Укажите цель обучения, контрольный вопрос и ответ.');
      if (!text(data,'criterion') || (!editing && !text(data,'title'))) throw new Error('Укажите название и критерий выполнения.');
      const [milestoneGoal,milestoneId = ''] = text(data,'milestone').split('/');
      if (milestoneGoal && text(data,'goalId') && text(data,'goalId') !== milestoneGoal) throw new Error('Этап должен принадлежать выбранной цели.');
      if (editing && int(data,'minutes') < task.minutes) throw new Error('Для сохранения зафиксированных трудозатрат сокращение длительности недоступно.');
      const update = {
        id:id || uid(), title:task?.title || text(data,'title'), description:text(data,'description'),
        date:text(data,'date'), time:text(data,'time'), minutes:int(data,'minutes'), difficulty:editing ? task.difficulty : text(data,'difficulty'),
        priority:text(data,'priority'), xp:editing ? task.xp : int(data,'xp'), criterion:text(data,'criterion'),
        goalId:milestoneGoal || text(data,'goalId'), milestoneId, skillId:editing ? task.skillId : text(data,'skillId'),
        kind, materialId:kind === 'study' ? materialId : '', studyXP:editing ? task.studyXP ?? 10 : int(data,'studyXP'),
        checkXP:editing ? task.checkXP ?? 15 : int(data,'checkXP'), question:started ? task.question : text(data,'question'),
        answer:started ? task.answer : text(data,'answer'),
      };
      if (task) {
        const target = next.tasks.find(t => t.id === id);
        target.history.push({type:'edit', date:today(), previous:target.date, reason:'Параметры обновлены вручную.'});
        Object.assign(target,update);
      } else next.tasks.push({ ...update, done:false, history:[] });
    }, 'Задание сохранено'));
  if (editing) {
    for (const name of ['difficulty','xp','skillId','studyXP','checkXP']) dialog.querySelector(`[name="${name}"]`)?.setAttribute('disabled','');
  }
  if (!started) toggleLearning();
}

function toggleLearning() {
  const fields = dialog.querySelector('#learning-fields');
  if (!fields) return;
  fields.hidden = dialog.querySelector('[name=kind]').value !== 'study';
  fields.disabled = fields.hidden;
}

function taskInfo(task) {
  const source = state.materials.find(m => m.id === task.materialId);
  modal(task.title, `<p>${dateLabel(task.date)} ${esc(task.time || '')} · ${esc(task.minutes)} мин · ${task.priority === 'high' ? 'Высокий приоритет' : 'Обычный приоритет'} · ${esc({light:'Лёгкая',normal:'Средняя',hard:'Сложная'}[task.difficulty])} сложность</p>
    <p class="preserve">${esc(task.description)}</p><p><b>Критерий</b> · ${esc(task.criterion || 'Зафиксируйте результат.')}</p>
    ${source ? '<div class="entry"><b>Учебный материал · ' + esc(source.title) + '</b>' + materialContent(source) + '</div>' : ''}
    ${task.kind === 'study' ? `<p>Изучение +${esc(task.studyXP)} XP · практика +${esc(task.xp)} XP · проверка +${esc(task.checkXP)} XP</p>
      ${task.question ? `<p><b>Контрольный вопрос</b> · ${esc(task.question)}</p>` : ''}` : ''}
    ${task.evidence ? '<p><b>Результат</b> · ' + esc(task.evidence) + '</p>' : ''}
    <div class="button-row">
    ${source && !task.studied ? button('study','Отметить изучение','book','secondary',task.id) : ''}
    ${task.studied && !task.checked && task.question ? button('test','Ответить на вопрос','check','secondary',task.id) : ''}
    ${!task.done && (task.kind !== 'study' || task.studied) ? button('finish','Завершить практику','check','primary',task.id) : ''}
    ${!task.done ? button('task-edit','Изменить параметры','edit','quiet',task.id) : ''}
    ${!task.done && !task.studied && !task.history.some(h => h.type === 'replace') ? button('replace','Заменить','','quiet',task.id) : ''}
    </div>
    ${task.history.length ? '<h3>История</h3>' + task.history.map(h => `<p>${dateLabel(h.date)} · ${esc(h.previous)} · ${esc(h.reason)}</p>`).join('') : ''}`);
}

function finishForm(task) {
  if (task.kind === 'study' && !task.studied) {
    taskInfo(task);
    return;
  }
  const required = state.settings.evidence === 'note' || task.kind === 'study';
  modal('Завершить задание', `<p>${esc(task.title)}</p><p>${esc(task.criterion || 'Зафиксируйте результат.')}</p>` +
    field(required ? 'Подтверждение результата' : 'Подтверждение результата (необязательно)',area('evidence','',required ? 'required' : '')),
    data => commit(next => complete(next,next.tasks.find(t => t.id === task.id),'practice',today(),text(data,'evidence')), 'Задание завершено'),
    'Завершить');
}

function replacementForm(task) {
  modal('Заменить задание', '<p>Сохраните цель, сложность, критерий и XP. Новое действие должно требовать как минимум столько же времени. Для каждого задания доступна одна замена.</p>' +
    field('Новое действие',titleInput()) + field('Что изменилось и почему эта замена подходит',area('reason','','required minlength="10"')) +
    field('Длительность, мин',numberInput('minutes',task.minutes,task.minutes,1440)),
    data => commit(next => replaceTask(next.tasks.find(t => t.id === task.id),{ title:text(data,'title'), reason:text(data,'reason'),minutes:int(data,'minutes') },today()),'Задание заменено'));
}

function readFile(file, asData = false) {
  if (!asData) return file.text();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function materialForm() {
  modal('Новый материал',
    field('Название',titleInput()) +
    fieldGrid(field('Формат',select('format',options(['Статья','YouTube','Книга','PDF','Учебный отчёт','Интерактивный материал','Встроенный урок','Заметка']),'Статья')),
      field('Длительность, мин',numberInput('minutes',20,1,1440))) +
    field('Описание',area('description')) + field('Ссылка на источник',input('url','','type="url" maxlength="2048"')) +
    field('Текст урока, заметки или отчёта',area('content')) + field('Файл PDF до 1 МБ',input('file','','type="file" accept="application/pdf,.pdf"')),
    async data => {
      const file = data.get('file');
      const source = text(data,'url');
      const url = safeUrl(source);
      const format = text(data,'format');
      let pdf = '';
      if (!text(data,'title') || (source && !url)) throw new Error('Проверьте название и ссылку. Поддерживаются HTTP и HTTPS.');
      if (file?.size) {
        if (file.size > 1000000 || !(await file.slice(0,5).text()).startsWith('%PDF-')) throw new Error('Выберите PDF до 1 МБ.');
        pdf = (await readFile(file,true)).replace(/^data:[^;]*;/,'data:application/pdf;');
      }
      if (format === 'YouTube' && (!url || !['youtu.be','www.youtube.com','youtube.com','m.youtube.com'].includes(new URL(url).hostname))) {
        throw new Error('Добавьте ссылку на YouTube.');
      }
      if (!url && !pdf && !text(data,'content')) throw new Error('Добавьте ссылку, PDF или текст.');
      return commit(next => {
        next.materials.push({id:uid(),title:text(data,'title'),format,minutes:int(data,'minutes'),description:text(data,'description'),url,pdf,text:text(data,'content')});
      },'Материал добавлен');
    });
}

function entryForm(importFile) {
  modal(importFile ? 'Импорт отчёта' : 'Запись в дневнике',
    field('Дата',input('date',today(),`type="date" min="${shift(today(),-30)}" max="${today()}" required`)) +
    (importFile ? field('Текстовый файл до 60 КБ',input('file','','type="file" accept=".txt,.md,text/plain,text/markdown" required')) :
      field('Что произошло и что изменилось',area('body','','required'))) +
    field('Следующий шаг (необязательно)',titleInput('action','',false)) + field('Минут на следующий шаг',numberInput('minutes',15,5,720)),
    async data => {
      const file = data.get('file');
      if (file?.size > 60000) throw new Error('Выберите текстовый файл до 60 КБ.');
      const body = importFile ? (await readFile(file)).trim() : text(data,'body');
      if (!body || body.length > 12000 || body.includes('\0')) throw new Error('Отчёт должен содержать от 1 до 12 000 символов текста.');
      return commit(next => {
        next.entries.push({id:uid(),date:text(data,'date'),text:body,action:text(data,'action'),minutes:int(data,'minutes'),source:importFile?'import':'manual'});
      },'Запись сохранена');
    });
}

function reviewForm() {
  modal('Создать обзор', '<p>Выберите день для анализа. Сохранённые итоги можно открыть повторно.</p>' +
    field('Дата обзора',input('date',shift(today(),-1),`type="date" min="${shift(today(),-30)}" max="${today()}" required`)),
    async data => {
      const date = text(data,'date');
      if (account) {
        if (!remote?.payload?.settings) await commit(() => {});
        if (!readSucceeded || failedDraft || syncing) throw new Error('Проверьте синхронизацию.');
        syncing = true;
        const request = authRequest;
        try {
          const row = await cloud.review(date,remote);
          if (request === authRequest) {
            useRow(row);
            render();
          }
        } finally {
          syncing = false;
        }
      } else {
        await commit(next => { reviewDay(next,date); });
      }
      toast('Обзор сохранён');
    }, 'Создать обзор');
}

function recordForm(kind) {
  const configs = {
    habit: ['Новая привычка', field('Периодичность',input('freq','Ежедневно','maxlength="100"')), next => next.habits],
    project: ['Новый проект', field('Результат проекта',area('desc')) + field('Цель',select('goal',related(state.goals,'Без цели'))), next => next.projects],
    health: ['Запись о здоровье', field('Раздел',select('kind',options(['Сон','Самочувствие','Вес','Питание','Активность','Другое']),'Самочувствие')) + field('Наблюдение',area('note')), next => next.health],
    finance: ['Финансовая операция', field('Тип',select('type',[['expense','Расход'],['income','Доход']],'expense')) + field('Сумма',input('amount','','type="number" min="0.01" max="1000000000000" step="0.01" required')), next => next.transactions],
    reward: ['Личная награда',field('Условие получения',area('condition','','required')),next => next.rewards],
  };
  const [heading,fields,collection] = configs[kind];
  modal(heading,field('Название',titleInput()) + fields,data => commit(next => {
    if (!text(data,'title')) throw new Error('Укажите название.');
    const item = Object.fromEntries([...data.entries()].map(([key,value])=>[key,String(value).trim()]));
    if (kind === 'finance') item.amount = int(data,'amount');
    if (kind === 'habit') item.logs = [];
    collection(next).push({...item,id:uid(),date:today()});
  },'Запись добавлена'));
}

async function backup(includeDevice) {
  const snapshot = account ? await cloud.export() : null;
  if (snapshot && (snapshot.owner !== account.id || snapshot.sha256 !== await checksum(snapshot.snapshot_text))) {
    throw new Error('Проверка облачной копии не пройдена.');
  }
  const device = includeDevice ? await deviceArchive() : null;
  if (device && account && device.owner && device.owner !== account.id) {
    throw new Error('Старые данные устройства связаны с другим аккаунтом.');
  }
  const content = JSON.stringify({ snapshot, device, state: account ? null : state });
  return { format:'LEVEL-backup-2', created:new Date().toISOString(), content, sha256:await checksum(content) };
}

function validateDownload(file, expected) {
  if (!file?.size || file.size > 100000000) throw new Error('Выберите скачанную копию.');
  return file.text().then(async text => {
    const archived = JSON.parse(text);
    if (archived.format !== 'LEVEL-backup-2' || archived.sha256 !== expected.sha256 ||
        archived.content !== expected.content || (await checksum(archived.content)) !== archived.sha256) {
      throw new Error('Копия отличается от исходных данных. Скачайте её повторно.');
    }
    return JSON.parse(archived.content);
  });
}

async function resetForm(deviceOnly = false) {
  if (syncing || failedDraft || (account && !readSucceeded)) throw new Error('Сначала завершите синхронизацию.');
  const archive = await backup(deviceOnly || !account);
  const date = today();
  modal(deviceOnly ? 'Очистить данные старой версии' : 'Сбросить данные LEVEL',
    `<p>${deviceOnly ? 'Будут удалены резервируемые записи и файлы на этом устройстве.' : account ? 'Все данные развития облачного аккаунта будут удалены. Вход в аккаунт сохранится. Старые данные на устройстве можно очистить отдельно.' : 'Все записи LEVEL в этом браузере, включая старые данные и файлы, будут удалены.'}</p>
     <p>Скачайте копию и выберите тот же файл для проверки.</p>
     ${button('reset-download','Скачать копию','cloud','secondary')}` +
    field('Скачанная резервная копия',input('file','','type="file" accept="application/json,.json" required')) +
    field('Введите СБРОСИТЬ',input('phrase','','required autocomplete="off"')),
    async data => {
      if (text(data,'phrase') !== 'СБРОСИТЬ') throw new Error('Введите СБРОСИТЬ.');
      const verified = await validateDownload(data.get('file'),archive);
      if (syncing || failedDraft) throw new Error('Завершите синхронизацию и скачайте свежую копию.');
      if (!account && JSON.stringify(verified.state) !== JSON.stringify(state)) throw new Error('Данные изменились. Скачайте свежую копию.');
      if (verified.device) await clearDeviceArchive(verified.device);
      if (!deviceOnly) {
        if (account) {
          if (verified.snapshot) {
            const request = authRequest;
            syncing = true;
            try {
              const row = await cloud.reset(verified.snapshot.revision,verified.snapshot.sha256,text(data,'phrase'));
              if (request !== authRequest) return;
              useRow(row);
            } finally {
              syncing = false;
            }
          } else {
            if (await cloud.read()) throw new Error('В облаке появились данные. Скачайте свежую копию.');
            state = fresh();
          }
        } else state = fresh();
        message = '';
        selected = date;
        go('home');
        onboarding();
        toast('Данные сброшены');
        return false;
      }
      render();
      toast('Данные устройства очищены');
    },'Сбросить','danger');
  dialog.querySelector('[data-action=reset-download]').addEventListener('click',() => download(archive,'level-reset-' + date + '.json'));
}

function restoreForm() {
  modal('Импортировать копию','<p>Импорт заменит текущие данные развития. Сначала сохраните их через экспорт.</p>' +
    field('Резервная копия LEVEL',input('file','','type="file" accept=".json,application/json" required')) +
    field('Введите ИМПОРТ',input('phrase','','required autocomplete="off"')),
    async data => {
      if (text(data,'phrase') !== 'ИМПОРТ') throw new Error('Введите ИМПОРТ.');
      const file = data.get('file');
      if (file.size > 12000000) throw new Error('Копия слишком велика для импорта.');
      const parsed = JSON.parse(await file.text());
      let source = parsed;
      if (parsed.format === 'LEVEL-backup-2') {
        if ((await checksum(parsed.content)) !== parsed.sha256) throw new Error('Контрольная сумма не совпала.');
        const { snapshot, state } = JSON.parse(parsed.content);
        if (snapshot && (snapshot.owner !== account?.id || await checksum(snapshot.snapshot_text) !== snapshot.sha256)) {
          throw new Error('Копия относится к другому аккаунту или повреждена.');
        }
        source = snapshot ? JSON.parse(snapshot.snapshot_text) : state;
      } else if (parsed.snapshot_text && await checksum(parsed.snapshot_text) === parsed.sha256) {
        throw new Error('Административный архив предназначен для ручного восстановления владельцем.');
      }
      if (!source || !Array.isArray(source.tasks) || !Array.isArray(source.goals) || !Array.isArray(source.skills)) throw new Error('Файл резервной копии LEVEL не распознан.');
      const next = migrate(source);
      day(next.settings.zone);
      if (!['tasks','goals','skills','entries','reviews','ledger','materials','habits','projects','health','transactions','rewards','pauseDates'].every(key => Array.isArray(next[key]))) {
        throw new Error('Структура резервной копии повреждена.');
      }
      return commit(draft => {
        for (const key of Object.keys(draft)) delete draft[key];
        Object.assign(draft,next);
      },'Копия импортирована');
    },'Импортировать','danger');
}

function authForm(mode = 'password') {
  if (!client) throw new Error('Модуль входа недоступен. Обновите страницу.');
  const email = field('Email',input('email','','type="email" required autocomplete="email"'));
  if (mode === 'link') {
    modal('Вход по ссылке', '<p>Мы отправим ссылку для входа или создания аккаунта. Откройте её в этом браузере.</p>' + email,
      async data => {
        const { error } = await client.auth.signInWithOtp({email:text(data,'email'),options:{emailRedirectTo:new URL('./?auth_setup=1',location.href).href}});
        if (error) throw new Error('Не удалось отправить ссылку. Проверьте email или повторите позже.');
        toast('Проверьте почту');
      },'Отправить ссылку');
    return;
  }
  modal('Войти в LEVEL', email + field('Пароль',input('password','','type="password" required autocomplete="current-password"')) +
    button('auth-link','Получить ссылку на почту','','quiet'),
    async data => {
      const { data: result, error } = await client.auth.signInWithPassword({email:text(data,'email'),password:data.get('password')});
      if (error) throw new Error('Не удалось войти. Проверьте email и пароль.');
      await setAccount(result.user);
      go('home');
    },'Войти');
}

function passwordForm() {
  needsPassword = false;
  const url = new URL(location.href);
  url.searchParams.delete('auth_setup');
  history.replaceState({},'',url.pathname + url.search);
  modal('Пароль для входа','<p>Пароль упрощает вход, в том числе в установленном приложении.</p>' +
    field('Пароль',input('password','','type="password" minlength="8" required autocomplete="new-password"')),
    async data => {
      const { error } = await client.auth.updateUser({password:data.get('password')});
      if (error) throw new Error('Не удалось сохранить пароль. Проверьте требования к нему.');
      toast('Пароль сохранён');
    });
}

function suggestionById(id, inState = state) {
  return inState.reviews.flatMap(r => r.suggestions).find(s => s.id === id);
}

const actions = {
  close: () => dialog.close(),
  setup: () => onboarding(),
  'skip-setup': async () => { await commit(next => { next.setup = true; }); dialog.close(); },
  theme: () => commit(next => { next.settings.theme = next.settings.theme === 'light' ? 'dark' : 'light'; }),
  tab: id => { panes[pageName()] = id; render(); dialog.querySelector('.form-error')?.replaceChildren(); },
  date: id => { selected = id; render(); },
  'review-page': () => go('plan','review'),
  settings: editSettings,
  goal: goalForm,
  skill: skillForm,
  'skill-info': id => skillInfo(state.skills.find(s => s.id === id)),
  proof: id => proofForm(state.skills.find(s => s.id === id)),
  'approve-proof': async id => {
    const [skillId, proofId] = id.split('/');
    await commit(next => {
      const skill = next.skills.find(s => s.id === skillId);
      const proof = skill.results.find(r => r.id === proofId);
      if (proof.status === 'approved') return 0;
      const improved = skill.results.filter(r => r.id !== proofId && r.status === 'approved' && (r.metric || r.title) === proof.metric && r.unit === proof.unit)
        .every(r => skill.direction === 'lower' ? proof.value < r.value : proof.value > r.value);
      if (!improved) throw new Error('Новый замер должен улучшать подтверждённый результат по этой метрике.');
      proof.status = 'approved';
      return award(next,proof.id + ':proof',15,today(),skillId);
    });
    skillInfo(state.skills.find(s => s.id === skillId));
  },
  milestone: id => commit(next => {
    const [goalId,milestoneId] = id.split('/');
    const milestone = next.goals.find(g => g.id === goalId).milestones.find(m => m.id === milestoneId);
    milestone.done = !milestone.done;
    return milestone.done ? award(next,milestoneId + ':milestone',15,today()) : 0;
  }),
  task: date => taskForm({date:date || selected || today()}),
  'goal-task': goalId => taskForm({goalId}),
  'skill-task': skillId => taskForm({skillId}),
  'task-edit': id => taskForm({id}),
  'task-info': id => taskInfo(state.tasks.find(t => t.id === id)),
  finish: id => finishForm(state.tasks.find(t => t.id === id)),
  study: async id => {
    await commit(next => complete(next,next.tasks.find(t => t.id === id),'study',today()),'Изучение отмечено');
    taskInfo(state.tasks.find(t => t.id === id));
  },
  test: id => {
    const task = state.tasks.find(t => t.id === id);
    modal('Проверка знаний',`<p>${esc(task.question)}</p>` + field('Ответ',titleInput('answer')),
      data => commit(next => checkAnswer(next,next.tasks.find(t => t.id === id),text(data,'answer'),today()),'Ответ принят'), 'Проверить');
  },
  replace: id => replacementForm(state.tasks.find(t => t.id === id)),
  material: materialForm,
  'material-info': id => {
    const material = state.materials.find(m => m.id === id);
    modal(material.title,materialContent(material));
  },
  entry: () => entryForm(false),
  'import-entry': () => entryForm(true),
  'run-review': reviewForm,
  approve: id => {
    const suggestion = suggestionById(id);
    modal('Применить изменение',`<p>${esc(suggestion.title)} · ${dateLabel(suggestion.to)}</p><p>${esc(suggestion.reason)}</p>`,
      () => commit(next => applySuggestion(next,suggestionById(id,next),today()),'Изменение применено'),'Применить');
  },
  reject: id => commit(next => { Object.assign(suggestionById(id,next),{status:'rejected',decidedOn:today()}); },'Предложение отклонено'),
  pause: date => commit(next => {
    if (next.pauseDates.includes(date)) next.pauseDates = next.pauseDates.filter(d => d !== date);
    else next.pauseDates.push(date);
  }),
  'habit-done': id => commit(next => {
    const habit = next.habits.find(h => h.id === id);
    habit.logs ??= [];
    if (habit.logs.includes(today())) return 0;
    habit.logs.push(today());
    return award(next,id + ':' + today(),5,today());
  }),
  'project-done': id => commit(next => { next.projects.find(p => p.id === id).done = true; },'Проект завершён'),
  'reward-done': id => commit(next => { next.rewards.find(p => p.id === id).claimed = true; },'Награда получена'),
  auth: () => authForm(),
  'auth-link': () => authForm('link'),
  'sign-out': async () => {
    if (failedDraft) throw new Error('Сначала синхронизируйте или скачайте черновик.');
    const {error} = await client.auth.signOut();
    if (error) throw new Error('Не удалось завершить сеанс.');
    await setAccount(null);
  },
  sync,
  'draft-export': () => download(failedDraft.state,'level-unsynced-draft.json'),
  'load-remote': async () => { failedDraft = null; dialog.close(); await sync(); },
  export: async () => { download(await backup(!account)); toast('Копия подготовлена'); },
  restore: restoreForm,
  reset: () => resetForm(),
  legacy: async () => {
    modal('Данные предыдущей версии','<p>Можно скачать снимок и локальные файлы старого LEVEL. Эти данные открываются только вручную.</p>' +
      `<div class="button-row">${button('legacy-export','Скачать данные устройства','cloud','secondary')}${button('legacy-reset','Очистить устройство','','danger')}</div>`);
  },
  'legacy-export': async () => { download(await backup(true),'level-device-backup.json'); toast('Копия подготовлена'); },
  'legacy-reset': () => resetForm(true),
  'agent-key': () => modal('Выпустить ключ','<p>Новый ключ заменит прежний. Он даёт право отправлять записи в дневник.</p>',async () => {
    const token = await cloud.rpc('level_agent_key',{revoke_key:false});
    modal('Ключ интеграции', '<p>Скопируйте ключ сейчас. Он показан один раз.</p>' +
      field('Ключ',input('token',token,'readonly')) + '<p>Метод POST <code>/rest/v1/rpc/level_ingest</code> принимает ключ и отчёт.</p>');
    return false;
  },'Выпустить'),
  'agent-revoke': () => modal('Отозвать ключ','<p>Агент больше не сможет отправлять записи с этим ключом.</p>',async () => {
    await cloud.rpc('level_agent_key',{revoke_key:true});
    toast('Ключ отозван');
  },'Отозвать','danger'),
};
for (const kind of ['habit','project','health','finance','reward']) actions[kind] = () => recordForm(kind);

document.addEventListener('click',async event => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.disabled) return;
  const action = actions[trigger.dataset.action];
  if (!action) return;
  try {
    await action(trigger.dataset.id);
  } catch (error) {
    if (dialog.open && dialog.querySelector('.form-error')) dialog.querySelector('.form-error').textContent = error.message;
    else toast(error.message);
  }
});
dialog.addEventListener('submit',async event => {
  event.preventDefault();
  if (!submit) return;
  const form = event.target;
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const result = await submit(new FormData(form));
    if (result !== false && form.isConnected) dialog.close();
  } catch (error) {
    if (form.isConnected) form.querySelector('.form-error').textContent = error.message;
    else toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});
dialog.addEventListener('close',() => {
  submit = null;
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  else document.querySelector('#main-content')?.focus({preventScroll:true});
});
document.addEventListener('change',event => {
  if (event.target.name === 'kind' && dialog.open) toggleLearning();
  if (event.target.id === 'plan-date' && event.target.value) {
    selected = event.target.value;
    render();
    document.querySelector('#plan-date')?.focus();
  }
});
window.addEventListener('hashchange',() => {
  render();
  document.querySelector('#main-content')?.focus({preventScroll:true});
  window.scrollTo(0,0);
});
window.addEventListener('online',sync);
document.addEventListener('visibilitychange',() => { if (!document.hidden) sync(); });
window.addEventListener('storage',event => {
  if (event.key === KEY && !account) {
    state = guest();
    if (dialog.open) dialog.close();
    render();
  }
});
window.addEventListener('beforeunload',event => {
  if (failedDraft || syncing) {
    event.preventDefault();
    event.returnValue = '';
  }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  const wasControlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !reloading && !failedDraft && !syncing) {
      reloading = true;
      location.reload();
    }
  });
}
render();
if (client) {
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') needsPassword = true;
    setTimeout(() => setAccount(session?.user),0);
  });
  client.auth.getSession().then(({data}) => setAccount(data.session?.user)).catch(() => setAccount(null));
} else {
  setAccount(null);
}
