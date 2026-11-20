import { day, shift, progress, skillProgress, plannedCapacity, safeUrl } from './model.js';
import { attr, esc, icon, button, iconButton, panelHead, empty, dateLabel } from './ui.js';

export const pages = [
  ['home', 'Главная', 'home'], ['plan', 'План', 'calendar'], ['growth', 'Развитие', 'growth'],
  ['goals', 'Цели', 'target'], ['profile', 'Профиль', 'user'],
];

const navigation = (page, mobile = false) => `<nav class="navigation ${mobile ? 'mobile-nav' : 'side-nav'}" aria-label="${mobile ? 'Мобильная навигация' : 'Основная навигация'}">
  ${pages.map(([id, title, glyph]) => `<a href="#${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph, 19)}<span>${title}</span></a>`).join('')}
</nav>`;

const avatar = name => name ? esc(name.trim().slice(0, 1).toLocaleUpperCase('ru')) : icon('user', 17);
const title = text => `<h1>${esc(text)}</h1>`;

export function shell(page, state, today, cloudStatus, account, contents) {
  return `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="#home" aria-label="LEVEL, главная"><span class="brand-mark">${icon('logo', 24)}</span><span>LEVEL</span></a>
      <div class="side-main">${navigation(page)}</div>
      <div class="sidebar-foot">
        <button class="theme-link" data-action="theme" type="button">${icon(state.settings.theme === 'dark' ? 'sun' : 'moon', 19)} ${state.settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</button>
        <a class="identity" href="#profile"><span class="avatar">${avatar(state.settings.name)}</span><span><b>${esc(state.settings.name || 'Ваш профиль')}</b><small>${account ? 'Облачный аккаунт' : 'На этом устройстве'}</small></span>${icon('arrow', 16)}</a>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <a href="#home" class="brand mobile-brand"><span class="brand-mark">${icon('logo', 21)}</span>LEVEL</a>
        <span class="breadcrumb">${pages.find(([id]) => id === page)?.[1] || 'Главная'}</span>
        <div class="top-actions"><span class="header-date">${icon('calendar', 16)} ${dateLabel(today, {weekday: 'long', day: 'numeric', month: 'long'})}</span>
          ${iconButton('theme', 'Переключить тему', state.settings.theme === 'dark' ? 'sun' : 'moon')}<a class="avatar" href="#profile" aria-label="Профиль">${avatar(state.settings.name)}</a></div>
      </header>
      ${cloudStatus ? `<div class="sync-banner" role="status">${icon('cloud', 17)} <span>${esc(cloudStatus)}</span>${button('sync', 'Проверить', '', 'quiet')}</div>` : ''}
      <main id="main-content" tabindex="-1">${contents}</main>
    </div>
    ${navigation(page, true)}
  </div>`;
}

function row(task, state) {
  const goal = state.goals.find(g => g.id === task.goalId);
  return `<article class="task-row">
    <button class="completion ${task.done ? 'checked' : ''}" type="button" data-action="${task.done ? 'task-info' : 'finish'}" data-id="${attr(task.id)}" aria-label="${attr(task.done ? 'Результат: ' + task.title : 'Завершить: ' + task.title)}">${task.done ? icon('check', 16) : ''}</button>
    <div class="task-copy"><button class="row-title" type="button" data-action="task-info" data-id="${attr(task.id)}">${esc(task.title)}</button>
      <small>${esc([task.time, goal?.title, task.kind === 'study' ? 'Обучение' : '', task.minutes + ' мин'].filter(Boolean).join(' · '))}</small></div>
    <span class="earned">${task.done ? '✓ ' : '+'}${esc(task.xp)} XP</span>
  </article>`;
}

const stat = (glyph, color, value, label, detail) => `<article class="panel stat">
  <span class="stat-icon ${color}">${icon(glyph, 19)}</span>
  <div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div><small>${esc(detail)}</small>
</article>`;

function weekChart(state, today) {
  const days = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
  const values = days.map(date => state.ledger.filter(event => event.date === date).reduce((sum, event) => sum + event.xp, 0));
  const max = Math.max(20, ...values);
  return `<div class="week-chart" role="img" aria-label="${attr(days.map((date, index) => dateLabel(date) + ' — ' + values[index] + ' XP').join(', '))}">
    ${days.map((date, i) => `<div class="chart-col ${date === today ? 'current' : ''}"><div class="chart-track"><span style="--value:${Math.ceil(values[i] / max * 100)}%"></span></div><small>${dateLabel(date, {weekday:'short'})}</small></div>`).join('')}
  </div>`;
}

export function home(state, today) {
  const p = progress(state, today);
  const localHour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:state.settings.zone,hour:'numeric',hourCycle:'h23'}).format(new Date()));
  const reminder = state.settings.notifications === 'in-app' && localHour >= 20 && !state.reviews.some(review => review.date === today);
  const tasks = state.tasks.filter(t => t.date === today);
  const done = tasks.filter(t => t.done).length;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const name = state.settings.name;
  return `<div class="page-head"><div><p class="eyebrow">${icon('sun', 15)} ${dateLabel(today, {weekday:'long', day:'numeric', month:'long'})}</p>${title(name ? 'Привет, ' + name : 'Обзор дня')}<p>Ваши задачи, цели и прогресс в одном месте.</p></div>${button('task', 'Новая задача', 'plus', 'primary')}</div>
    ${reminder ? `<div class="panel pad reminder">${icon('journal',19)} <span>Подведите итоги дня, пока детали свежи.</span>${button('review-page','Открыть дневник','','quiet')}</div>` : ''}
    <div class="dashboard">
      <div class="dashboard-main">
        <section class="hero"><div class="hero-content"><div class="hero-label">${icon('growth', 17)} Личное развитие</div>
        <h2>${state.setup ? 'Ваш следующий шаг' : 'Начните с малого'}</h2><p>${state.setup ? 'Выберите, чему уделить время сегодня.' : 'Выберите направления развития и настройте свой темп.'}</p>
        ${state.setup ? '<a class="button hero-button" href="#plan">Открыть план</a>' : button('setup', 'Настроить LEVEL', '', 'hero-button')}</div></section>
        <div class="stats">
          ${stat('bolt', 'blue', p.total + ' XP', 'Опыт', 'Уровень ' + p.level)}
          ${stat('check', 'green', done + ' из ' + tasks.length, 'Задачи сегодня', tasks.length ? percent + '% выполнено' : 'План пока свободен')}
          ${stat('growth', 'violet', p.streak + ' дн.', 'Серия активности', p.streak ? 'Дни с прогрессом' : 'Первый день впереди')}
        </div>
        <section class="panel pad">${panelHead('Задачи на сегодня', '<a class="text-link" href="#plan">Весь план</a>')}
          ${tasks.length ? tasks.slice(0, 5).map(t => row(t, state)).join('') : empty('calendar', 'На сегодня задач нет', 'Добавьте действие, которое приблизит вас к цели.', button('task', 'Добавить задачу', 'plus', 'quiet'))}
        </section>
        <section class="panel pad">${panelHead('Активность за неделю', '<a class="text-link" href="#profile">Статистика</a>')}${weekChart(state, today)}</section>
      </div>
      <aside class="dashboard-side">
        <section class="panel pad focus-panel">${panelHead('Фокус дня')}
          <div class="ring" role="img" aria-label="${percent}% задач выполнено" style="--progress:${percent}%"><div><strong>${percent}%</strong><small>выполнено</small></div></div>
          <div class="ring-summary"><span>${done} выполнено</span><span>${tasks.length - done} осталось</span></div>
        </section>
        <section class="panel pad review-panel"><span class="stat-icon blue">${icon('star', 21)}</span><h2>Обзор дня</h2><p>Подведите итоги, внесите изменения в план и оцените нагрузку на завтра.</p>
          ${button('review-page', 'Открыть обзор', '', 'secondary')}
        </section>
        <section class="panel pad">${panelHead('Цели', '<a class="text-link" href="#goals">Все цели</a>')}
          ${state.goals.length ? state.goals.slice(0, 3).map(goal => `<div class="mini-row">${icon('target', 16)} <span>${esc(goal.title)}</span></div>`).join('') : empty('target', 'К чему вы идёте?', 'Сформулируйте первую цель.', button('goal', 'Создать цель', 'plus', 'quiet'))}
        </section>
      </aside>
    </div>`;
}

const tabs = (name, current, items) => `<div class="tabs" aria-label="${esc(name)}">${items.map(([id, label]) => `<button type="button" data-action="tab" data-id="${id}" aria-pressed="${id === current}">${esc(label)}</button>`).join('')}</div>`;

export function plan(state, today, selected, pane) {
  const week = Array.from({ length: 7 }, (_, i) => shift(today, i));
  const tasks = state.tasks.filter(t => t.date === selected).sort((a, b) => Number(a.done) - Number(b.done) || (a.time || '25').localeCompare(b.time || '25'));
  const pending = tasks.filter(t => !t.done).reduce((sum, t) => sum + t.minutes, 0);
  const budget = plannedCapacity(state, selected);
  const overdue = state.tasks.filter(t => !t.done && t.date && t.date < today);
  return `<div class="page-head"><div>${title('План')}<p>Ежедневные действия и время на развитие.</p></div>${button('task', 'Новая задача', 'plus', 'primary', selected)}</div>
  ${tabs('Разделы плана', pane, [['calendar','Расписание'], ['review','Обзор дня'], ['habits','Привычки']])}
  ${pane === 'review' ? reviewView(state, today) : pane === 'habits' ? habitView(state, today) : `
  <section class="panel pad"><div class="week-strip">${week.map(date => `<button type="button" data-action="date" data-id="${date}" aria-pressed="${date === selected}"><span>${dateLabel(date, {weekday:'short'})}</span><b>${Number(date.slice(-2))}</b></button>`).join('')}</div>
  <label class="date-control">Выбрать дату <input type="date" id="plan-date" value="${attr(selected)}"></label></section>
  <section class="panel pad spaced">${panelHead(dateLabel(selected), button('pause', state.pauseDates.includes(selected) ? 'Снять паузу' : 'День отдыха', 'moon', 'quiet', selected))}
  <p class="muted">${pending} мин в плане · ${budget} мин доступно</p>
  ${tasks.length ? tasks.map(t => row(t, state)).join('') : empty('calendar','План свободен','Здесь появятся задачи на выбранную дату.')}</section>
  ${overdue.length ? `<section class="panel pad spaced">${panelHead('Просроченные задачи')}${overdue.map(t => row(t, state)).join('')}</section>` : ''}
  `}`;
}

function habitView(state, today) {
  return `<section class="panel pad">${panelHead('Привычки', button('habit', 'Добавить', 'plus', 'secondary'))}
  ${state.habits.length ? state.habits.map(h => `<div class="list-row"><span><strong>${esc(h.title)}</strong><small>${(h.logs || []).length} отметок · ${esc(h.freq || 'Ежедневно')}</small></span>
    ${(h.logs || []).includes(today) ? '<span class="pill success">Сегодня ✓</span>' : button('habit-done','Отметить','check','secondary',h.id)}</div>`).join('') : empty('check','Привычек пока нет','Добавьте действие, которое хотите повторять.')}</section>`;
}

function reviewView(state, today) {
  return `<div class="content-grid">
    <div class="stack"><section class="panel pad">${panelHead('Daily Review', '<span class="pill">Правила LEVEL</span>')}<p>Обзор сверяет дневник и задачи, оценивает время и предлагает изменения. Ваши записи обрабатываются в LEVEL.</p>
      <div class="button-row">${button('run-review','Создать обзор','star','primary')}${button('settings','Правила планирования','settings','quiet')}</div></section>
      ${state.reviews.length ? state.reviews.map(r => `<section class="panel pad">${panelHead('Итоги · ' + dateLabel(r.date))}
        <p>${esc(r.completed)} выполнено · ${esc(r.pending)} открыто · ${esc(r.entries)} записей. На ${dateLabel(r.next)} запланировано ${esc(r.load)} из ${esc(r.budget)} мин.</p>
        ${r.suggestions.length ? r.suggestions.map(s => `<div class="list-row suggestion"><div><small>${esc({move:'Перенос задачи',add:'Новая задача',goal:'Срок цели'}[s.type])} · ${s.risk === 'low' ? 'Низкий риск' : 'Средний риск'} · ${dateLabel(s.to)}</small><strong>${esc(s.title)}</strong><small>${esc(s.reason)}</small></div>
          ${s.status === 'pending' ? `<div class="button-row">${button('approve','Принять','','secondary',s.id)}${button('reject','Отклонить','','quiet',s.id)}</div>` : `<span class="pill">${esc({automatic:'Применено автоматически',accepted:'Принято',rejected:'Отклонено'}[s.status])}</span>`}</div>`).join('') : '<p class="muted">Подходящих изменений для этого дня нет.</p>'}</section>`).join('') : ''}
    </div>
    <section class="panel pad">${panelHead('Дневник', button('entry','Запись','plus','secondary'))}
    <p>Запишите, что произошло и какие обязательства появились. Можно добавить текст из ChatGPT вручную.</p>
    ${button('import-entry','Импортировать отчёт','journal','quiet')}
    ${state.entries.length ? [...state.entries].reverse().slice(0, 30).map(e => `<div class="entry"><small>${dateLabel(e.date)} · ${esc({manual:'Запись',import:'Импорт',agent:'Внешний агент'}[e.source] || 'Дневник')}</small><p>${esc(e.text)}</p>${e.action ? `<small>Следующий шаг · ${esc(e.action)} (${esc(e.minutes)} мин)</small>` : ''}</div>`).join('') : empty('journal','Дневник чист','Добавьте первую запись.')}</section>
  </div>`;
}

export function growth(state, pane) {
  return `<div class="page-head"><div>${title('Развитие')}<p>Практика, знания и подтверждённые результаты.</p></div>${pane === 'materials' ? button('material','Новый материал','plus','primary') : button('skill','Новый навык','plus','primary')}</div>
    ${tabs('Разделы развития', pane, [['skills','Навыки'], ['materials','Материалы']])}
    ${pane === 'materials' ? `<section class="panel pad">${panelHead('Библиотека')}
      ${state.materials.length ? state.materials.map(m => `<div class="list-row"><span><strong>${esc(m.title)}</strong><small>${esc(m.format)} · ${esc(m.minutes)} мин · ${esc(m.description)}</small></span>${button('material-info','Открыть','book','secondary',m.id)}</div>`).join('') : empty('book','Библиотека пуста','Добавьте ссылку, PDF, урок или заметку.')}</section>` :
      state.skills.length ? `<div class="card-grid">${state.skills.map(s => {
        const p = skillProgress(state, s);
        return `<article class="panel pad"><div class="card-top"><span class="stat-icon blue">${icon('growth',21)}</span><span class="pill">${esc(s.category || 'Навык')}</span></div>
        <h2>${esc(s.title)}</h2><p>${esc(s.description)}</p><div class="meter"><span style="--value:${p.xp % 100}%"></span></div><p class="muted">Уровень ${p.level} · ${p.xp} XP</p><p>${esc(p.rank)}</p>
        <div class="button-row">${button('skill-info','Результаты','','secondary',s.id)}${button('proof','Добавить замер','plus','quiet',s.id)}</div></article>`;
      }).join('')}</div>` : `<section class="panel pad">${empty('growth','Навыков пока нет','Выберите навык и определите измеримый результат.',button('skill','Добавить навык','plus','secondary'))}</section>`}`;
}

export function goals(state, pane) {
  return `<div class="page-head"><div>${title('Цели')}<p>Связывайте долгосрочные результаты с действиями на неделе.</p></div>
    ${pane === 'projects' ? button('project','Новый проект','plus','primary') : button('goal','Новая цель','plus','primary')}</div>
    ${tabs('Разделы целей', pane, [['goals','Цели и этапы'], ['projects','Проекты']])}
    ${pane === 'projects' ? `<section class="panel pad">${panelHead('Проекты')}
      ${state.projects.length ? state.projects.map(p => `<div class="list-row"><span><strong>${esc(p.title)}</strong><small>${esc(p.desc)}</small><small>${p.done ? 'Завершён' : 'В работе'} · ${dateLabel(p.deadline)}</small></span>${button('project-info','Открыть','flag','secondary',p.id)}</div>`).join('') : empty('flag','Проектов пока нет','Добавьте проект с конкретным итогом.')}</section>` :
    state.goals.length ? `<div class="card-grid">${state.goals.map(g => {
      const done = g.milestones.filter(m => m.done).length;
      return `<article class="panel pad"><div class="card-top"><span class="stat-icon blue">${icon('target',21)}</span><span class="pill">${dateLabel(g.deadline)}</span></div>
        <h2>${esc(g.title)}</h2><p>${esc(g.description)}</p><div class="meter"><span style="--value:${g.milestones.length ? done / g.milestones.length * 100 : 0}%"></span></div>
        <p class="muted">${done} из ${g.milestones.length} этапов · ${state.tasks.filter(t => t.goalId === g.id).length} задач</p>
        <div class="milestones">${g.milestones.map(m => `<button type="button" data-action="milestone" data-id="${attr(g.id + '/' + m.id)}" aria-pressed="${!!m.done}">${icon(m.done ? 'check' : 'circle',18)} ${esc(m.title)}</button>`).join('')}</div>
        <div class="button-row">${button('goal','Редактировать','edit','quiet',g.id)}${button('goal-task','Добавить задачу','plus','secondary',g.id)}</div>
      </article>`;
    }).join('')}</div>` : `<section class="panel pad">${empty('target','Целей пока нет','Опишите, к какому результату хотите прийти.',button('goal','Создать цель','plus','secondary'))}</section>`}`;
}

export function profile(state, today, pane, account) {
  const p = progress(state, today);
  const achievements = [
    ['check','Первое действие',state.tasks.some(t => t.done)],
    ['bolt','100 XP',p.total >= 100], ['target','Цель достигнута',state.goals.some(g => g.milestones.length && g.milestones.every(m => m.done))],
    ['growth','Неделя активности',p.streak >= 7],
  ];
  const weekly = state.transactions.filter(t => t.date >= shift(today,-6) && t.date <= today && ['expense','Расход'].includes(t.type))
    .reduce((sum,t) => sum + Number(t.amount),0);
  const balance = state.transactions.reduce((sum, t) => sum + Number(t.amount) * (['expense','Расход'].includes(t.type) ? -1 : 1), 0);
  return `<div class="page-head"><div>${title('Профиль')}<p>${esc(account?.email || 'Данные на этом устройстве')}</p></div>${button(account ? 'sign-out' : 'auth', account ? 'Выйти' : 'Войти в аккаунт','user','secondary')}</div>
  ${tabs('Разделы профиля', pane, [['stats','Статистика'],['health','Здоровье'],['finance','Финансы'],['settings','Настройки']])}
  ${pane === 'stats' ? `<div class="content-grid"><div class="stack"><section class="panel pad">${panelHead('Активность за неделю')}${weekChart(state,today)}
    <div class="meter"><span style="--value:${p.next}%"></span></div><p class="muted">Уровень ${p.level} · ${p.total} XP · ${100 - p.next} XP до следующего уровня</p></section>
    <section class="panel pad">${panelHead('Личные награды', button('reward','Добавить','plus','quiet'))}
    ${state.rewards.length ? state.rewards.map(r => `<div class="list-row"><span><strong>${esc(r.title)}</strong><small>${esc(r.condition)}</small></span>${r.claimed ? '<span class="pill success">Получена</span>' : button('reward-done','Получить','check','quiet',r.id)}</div>`).join('') : empty('flag','Наград пока нет','Выберите, как отметить важный результат.')}</section></div>
    <section class="panel pad">${panelHead('Достижения')}
    ${achievements.map(([glyph,label,done]) => `<div class="list-row"><div class="achievement"><span class="stat-icon ${done ? 'blue' : ''}">${icon(glyph,18)}</span><strong>${label}</strong></div><span class="pill ${done ? 'success' : ''}">${done ? 'Открыто' : 'Впереди'}</span></div>`).join('')}</section></div>` : ''}
  ${pane === 'health' ? `<section class="panel pad">${panelHead('Журнал здоровья', button('health','Новая запись','plus','secondary'))}
    <div class="button-row">${state.body.height ? `<span class="pill">Рост · ${esc(state.body.height)} см</span>` : ''}
      ${state.body.weight ? `<span class="pill">Последний вес · ${esc(state.body.weight)} кг</span>` : ''}
      ${button('health-settings','Параметры тела','','quiet')}</div>
    ${state.health.length ? [...state.health].reverse().map(r => `<div class="list-row"><span><strong>${esc(r.title)}</strong><small>${dateLabel(r.date)} · ${esc(r.kind)} · ${esc(r.note)}</small></span>${icon('heart',19)}</div>`).join('') : empty('heart','Записей пока нет','Добавляйте наблюдения о сне, питании, весе и самочувствии.')}</section>` : ''}
  ${pane === 'finance' ? `<section class="panel pad">${panelHead('Финансовый журнал', button('finance','Новая операция','plus','secondary'))}
    <p>Баланс · <strong>${new Intl.NumberFormat('ru-RU').format(balance)} ${esc(state.finance.currency)}</strong></p>
    <div class="button-row">${state.finance.budget ? `<span class="pill">За семь дней · ${new Intl.NumberFormat('ru-RU').format(weekly)} из ${esc(state.finance.budget)} ${esc(state.finance.currency)}</span>` : ''}
      ${button('budget','Настроить бюджет','','quiet')}</div>
    ${state.finance.note ? '<p>'+esc(state.finance.note)+'</p>' : ''}
    ${state.transactions.length ? [...state.transactions].reverse().map(r => `<div class="list-row"><span><strong>${esc(r.title)}</strong><small>${dateLabel(r.date)}</small></span><span class="pill">${['expense','Расход'].includes(r.type) ? '−' : '+'}${new Intl.NumberFormat('ru-RU').format(r.amount)}</span></div>`).join('') : empty('wallet','Операций пока нет','Фиксируйте доходы и расходы в одной выбранной валюте.')}</section>` : ''}
  ${pane === 'settings' ? `<div class="content-grid"><div class="stack">
    <section class="panel pad">${panelHead('Планирование')}${button('settings','Настроить развитие','settings','secondary')}<p>${esc(state.settings.minutes)} мин в день · ${esc(state.settings.zone)} · ${state.settings.nightly ? 'Ночной обзор включён' : 'Ручной запуск обзора'}</p></section>
    <section class="panel pad">${panelHead('Интеграция дневника')}${account ? `<p>Выдайте внешнему агенту ключ, чтобы он мог добавлять дневные отчёты.</p><div class="button-row">${button('agent-key','Выпустить ключ','shield','secondary')}${button('agent-revoke','Отозвать ключ','','quiet')}</div>` : '<p>Войдите, чтобы подключить внешний агент.</p>'}<p>Доступ к истории чатов ChatGPT отсутствует. Скопируйте дневной отчёт в дневник или явно передайте его через API.</p></section>
    </div><div class="stack"><section class="panel pad">${panelHead('Данные и синхронизация')}<p>${account ? 'Изменения сохраняются в вашем облачном аккаунте.' : 'Данные хранятся в этом браузере. Резервные копии можно скачать вручную.'}</p><div class="button-row">${button('export','Скачать копию','cloud','secondary')}${button('restore','Импортировать копию','','quiet')}</div></section>
    <section class="panel pad danger-panel">${panelHead('Сброс данных')}<p>Скачайте и проверьте резервную копию перед очисткой. После сброса LEVEL откроет первоначальную настройку.</p>
    <div class="button-row">${button('reset','Сбросить данные','','danger')}${button('legacy','Данные старой версии','','quiet')}</div></section></div></div>` : ''}
  `;
}

export function materialContent(material) {
  const url = safeUrl(material.url);
  const pdf = /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(material.pdf || '') ? material.pdf : '';
  return `<p>${esc(material.format)} · ${esc(material.minutes)} мин</p><p>${esc(material.description)}</p>
    ${url ? `<p><a href="${attr(url)}" target="_blank" rel="noopener noreferrer">Открыть источник</a></p>` : ''}
    ${pdf ? `<p><a href="${attr(pdf)}" download="level-material.pdf">Скачать PDF</a></p>` : ''}
    ${material.text ? `<p class="preserve">${esc(material.text)}</p>` : ''}`;
}
