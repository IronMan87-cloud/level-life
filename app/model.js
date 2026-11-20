export const VERSION = 2;
export const uid = () => crypto.randomUUID();
export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function day(zone, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function shift(date, days) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function fresh(zone = timezone()) {
  return {
    version: VERSION,
    setup: false,
    settings: {
      name: '', zone, directions: [], minutes: 45, intensity: 'Умеренная',
      schedule: '', approach: 'Гибкий', evidence: 'note', notifications: 'off',
      nightly: false, autoMove: false, theme: 'dark', workStart: '', workEnd: '', sleepStart: '', sleepEnd: '',
    },
    goals: [], skills: [], tasks: [], materials: [], entries: [], reviews: [],
    ledger: [], habits: [], projects: [], transactions: [], health: [],
    rewards: [], pauseDates: [], legacyXP: 0,
    finance: { budget: null, currency: '', note: '' }, body: { height: null, weight: null },
  };
}

const list = value => Array.isArray(value) ? value : [];
const validObject = value => value && typeof value === 'object' && !Array.isArray(value);

export function migrate(source) {
  if (!validObject(source)) throw new Error('Формат данных LEVEL не распознан.');
  if (source.version > VERSION) throw new Error('Для этой копии нужна более новая версия LEVEL.');
  const empty = fresh();
  if (source.version === VERSION) {
    return { ...empty, ...source, settings: { ...empty.settings, ...source.settings } };
  }
  return {
    ...empty,
    setup: true,
    legacyXP: Number(source.activityXP) || 0,
    goals: list(source.goals).map(g => ({ ...g, description: g.desc || '', deadline: g.date || '', milestones: list(g.milestones) })),
    skills: list(source.skills).map(s => ({
      ...s, category: s.cat || '', description: s.baseline || '', metric: '', target: null,
      unit: '', direction: 'higher', results: list(source.proofs).filter(p => p.skill === s.id),
    })),
    tasks: list(source.tasks).map(t => ({
      ...t, goalId: t.goal || '', skillId: t.skill || '', minutes: parseInt(t.duration, 10) || 15,
      priority: t.priority === 'Главный результат' ? 'high' : 'normal',
      difficulty: 'normal', kind: 'practice', xp: 10,
      criterion: t.successCriteria || '', materialId: '', history: [],
      completedOn: t.done ? t.date : null,
    })),
    habits: list(source.habits), projects: list(source.projects), transactions: list(source.transactions),
    rewards: list(source.rewards), pauseDates: list(source.pauseDates),
    health: [
      ...list(source.health?.meals).map(r => ({ ...r, kind: 'Питание', note: r.desc || '' })),
      ...list(source.health?.weightLogs).map(r => ({ ...r, kind: 'Вес', title: r.weightKg + ' кг' })),
    ],
    finance: { budget: Number(source.weeklyBudget) || null, currency: '', note: String(source.financeNote || '') },
    body: { height: Number(source.health?.heightCm) || null, weight: Number(source.health?.weightKg) || null },
    legacy: source,
  };
}

export function award(state, id, xp, date, skillId = '') {
  if (state.ledger.some(event => event.id === id)) return 0;
  state.ledger.push({ id, xp, date, skillId });
  return xp;
}

export function progress(state, today) {
  const total = state.legacyXP + state.ledger.reduce((sum, event) => sum + event.xp, 0);
  const dates = new Set([...state.ledger.map(e => e.date), ...state.tasks.map(t => t.completedOn).filter(Boolean)]);
  let streak = 0;
  let cursor = dates.has(today) ? today : shift(today, -1);
  while (dates.has(cursor) || state.pauseDates.includes(cursor)) {
    if (dates.has(cursor)) streak++;
    cursor = shift(cursor, -1);
  }
  return { total, level: 1 + Math.floor(total / 100), next: total % 100, streak };
}

export function skillProgress(state, skill) {
  const xp = (Number(skill.xp) || 0) + state.ledger.filter(e => e.skillId === skill.id).reduce((sum, e) => sum + e.xp, 0);
  const rank = skill.target != null && list(skill.results).some(result => result.status === 'approved' &&
    result.metric === skill.metric && result.unit === skill.unit &&
    (skill.direction === 'lower' ? result.value <= skill.target : result.value >= skill.target));
  return { xp, level: 1 + Math.floor(xp / 100), rank: rank ? 'Норматив подтверждён' : 'Без подтверждённого ранга' };
}

export function complete(state, task, stage, date, evidence = '') {
  if (task.done) return 0;
  if (stage === 'study') {
    if (task.kind !== 'study' || !state.materials.some(item => item.id === task.materialId)) {
      throw new Error('Прикрепите учебный материал.');
    }
    task.studied = true;
    return award(state, task.id + ':study', task.studyXP, date, task.skillId);
  }
  if (stage !== 'practice') throw new Error('Неизвестный этап задания.');
  if (task.kind === 'study' && !task.studied) throw new Error('Сначала отметьте изучение материала.');
  if ((state.settings.evidence === 'note' || task.kind === 'study') && !evidence.trim()) {
    throw new Error('Опишите полученный результат.');
  }
  task.done = true;
  task.completedOn = date;
  task.evidence = evidence.trim();
  return award(state, task.id + ':practice', task.xp, date, task.skillId);
}

export function checkAnswer(state, task, answer, date) {
  if (!task.answer || !task.studied) throw new Error('Проверка пока недоступна.');
  if (task.answer.trim().toLocaleLowerCase('ru') !== answer.trim().toLocaleLowerCase('ru')) {
    throw new Error('Ответ не совпал. Можно попробовать ещё раз.');
  }
  task.checked = true;
  return award(state, task.id + ':check', task.checkXP, date, task.skillId);
}

export function replaceTask(task, { title, reason, minutes }, date) {
  if (task.done || task.studied || task.history.some(item => item.type === 'replace')) {
    throw new Error('Замену можно сделать один раз до начала задания.');
  }
  if (reason.trim().length < 10 || title.trim().length < 3 || task.title === title.trim() || minutes < task.minutes) {
    throw new Error('Укажите новое действие, причину и сохраните исходную длительность или увеличьте её.');
  }
  task.history.push({ type: 'replace', date, previous: task.title, reason: reason.trim() });
  task.title = title.trim();
  task.minutes = minutes;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function plannedCapacity(state, date) {
  if (state.pauseDates.includes(date)) return 0;
  const { minutes, workStart, workEnd, sleepStart, sleepEnd } = state.settings;
  const duration = (start, end) => {
    if (!start || !end) return 0;
    const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    return (toMinutes(end) - toMinutes(start) + 1440) % 1440;
  };
  return Math.min(minutes, Math.max(0, 1440 - duration(workStart, workEnd) - duration(sleepStart, sleepEnd)));
}

export function reviewDay(state, date) {
  const existing = state.reviews.find(item => item.date === date);
  if (existing) return existing;
  const next = shift(date, 1);
  const source = state.entries.filter(item => item.date === date);
  const suggestions = [];
  const pending = state.tasks.filter(t => !t.done && t.date && t.date <= date);
  const nextTasks = state.tasks.filter(t => !t.done && t.date === next);
  const budget = plannedCapacity(state, next);
  const load = nextTasks.reduce((sum, t) => sum + t.minutes, 0);
  let reserved = load;
  const add = fields => suggestions.push({ id: uid(), status: 'pending', ...fields });
  const ordered = [...pending].sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high'));
  for (const task of ordered.slice(0, 20)) {
    if (task.minutes + reserved > budget) continue;
    reserved += task.minutes;
    add({ type: 'move', risk: task.priority === 'high' ? 'medium' : 'low',
      taskId: task.id, from: task.date, to: next, title: task.title,
      reason: 'Задание открыто и помещается в доступное время.' });
  }
  for (const entry of source) {
    if (!entry.action || reserved + entry.minutes > budget || state.tasks.some(t => t.title.toLocaleLowerCase() === entry.action.toLocaleLowerCase()) ||
        suggestions.some(s => s.type === 'add' && s.title.toLocaleLowerCase() === entry.action.toLocaleLowerCase())) continue;
    reserved += entry.minutes;
    add({ type: 'add', risk: 'low', title: entry.action, minutes: entry.minutes, to: next,
      reason: 'Следующий шаг указан в записи дневника.', contextId: entry.id });
  }
  for (const goal of state.goals.filter(g => g.deadline && g.deadline <= date && !(g.milestones?.length && g.milestones.every(m => m.done))).slice(0, 10)) {
    add({ type: 'goal', risk: 'medium', goalId: goal.id, from: goal.deadline, to: shift(next, 6),
      title: goal.title, reason: 'Срок цели истёк. Проверьте, нужен ли дополнительный срок.' });
  }
  const review = { date, next, budget, load, completed: state.tasks.filter(t => t.completedOn === date).length,
    pending: pending.length, entries: source.length, suggestions, engine: 'rules' };
  state.reviews.unshift(review);
  if (state.settings.autoMove) {
    for (const suggestion of suggestions.filter(s => s.type === 'move' && s.risk === 'low')) {
      applySuggestion(state, suggestion, date, true);
    }
  }
  return review;
}

export function applySuggestion(state, suggestion, date, automatic = false) {
  if (suggestion.status !== 'pending') return;
  const { type, to, from, title, reason } = suggestion;
  if (type === 'goal') {
    const goal = state.goals.find(g => g.id === suggestion.goalId);
    if (!goal || goal.deadline !== from) throw new Error('Цель изменилась после обзора.');
    goal.deadline = to;
  } else {
    const task = state.tasks.find(t => t.id === suggestion.taskId);
    if (type === 'move' && (!task || task.done || task.date !== from)) throw new Error('Задание уже изменилось.');
    if (type === 'add' && state.tasks.some(t => t.title.toLocaleLowerCase() === title.toLocaleLowerCase())) throw new Error('Задание уже существует.');
    const load = state.tasks.filter(t => !t.done && t.date === to).reduce((sum, t) => sum + t.minutes, 0);
    if (load + (task?.minutes ?? suggestion.minutes) > plannedCapacity(state, to)) throw new Error('В этот день больше нет свободного времени.');
    if (type === 'move') {
      task.history.push({ type: 'move', date, previous: from, reason });
      task.date = to;
    } else if (type === 'add') {
      state.tasks.push({ id: uid(), title, date: to, minutes: suggestion.minutes, kind: 'practice',
        xp: 10, criterion: 'Зафиксируйте результат.', difficulty: 'normal', priority: 'normal', history: [], done: false });
    }
  }
  suggestion.status = automatic ? 'automatic' : 'accepted';
  suggestion.decidedOn = date;
}
