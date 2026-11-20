import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, migrate, day, shift, complete, checkAnswer, replaceTask, skillProgress, progress, reviewDay, applySuggestion, plannedCapacity, safeUrl } from '../app/model.js';

const monday = '2026-11-16';
const tuesday = '2026-11-17';
const baseTask = (fields = {}) => ({
  id: 't', title: 'Практика', date: monday, kind: 'practice', xp: 20, minutes: 30,
  priority: 'normal', history: [], ...fields,
});

test('new users start empty, legacy rewards and records are preserved', () => {
  const state = fresh('UTC');
  assert.equal(state.setup, false);
  assert.equal(state.tasks.length + state.skills.length + state.goals.length, 0);
  assert.deepEqual(progress(state, monday), { total:0, level:1, next:0, streak:0 });
  const old = migrate({ activityXP:120, tasks:[{id:'old',done:true,date:monday}], health:{ meals:[{title:'meal'}] } });
  assert.equal(old.tasks[0].completedOn,monday);
  assert.equal(old.health[0].title,'meal');
  assert.equal(progress(old,monday).total,120);
  assert.deepEqual(migrate({ version:2 }),fresh());
});

test('competence rank depends on confirmed measurements independently of XP', () => {
  const state = fresh('UTC');
  const skill = { id:'s', xp:490, target:12, direction:'lower', metric:'Time', unit:'s', results:[] };
  assert.equal(skillProgress(state,skill).level,5);
  assert.match(skillProgress(state,skill).rank,/Без/);
  skill.results.push({ metric:'Time', unit:'s', value:10, status:'pending' });
  assert.match(skillProgress(state,skill).rank,/Без/);
  skill.results[0].status = 'approved';
  assert.equal(skillProgress(state,skill).rank,'Норматив подтверждён');
});

test('material, practice evidence, and quiz are independent and award XP exactly once', () => {
  const state = fresh('UTC');
  const task = baseTask({ kind:'study', materialId:'m', studyXP:10, checkXP:15, answer:'42', skillId:'skill' });
  assert.throws(() => complete(state,task,'study',monday),/материал/);
  state.materials.push({ id:'m' });
  assert.throws(() => complete(state,task,'practice',monday,'Готово'),/изучение/);
  assert.equal(complete(state,task,'study',monday),10);
  assert.equal(complete(state,task,'study',monday),0);
  assert.throws(() => checkAnswer(state,task,'41',monday),/не совпал/);
  assert.equal(checkAnswer(state,task,' 42 ',monday),15);
  assert.equal(checkAnswer(state,task,'42',monday),0);
  assert.throws(() => complete(state,task,'practice',monday,' '),/результат/);
  assert.equal(complete(state,task,'practice',monday,'Готово'),20);
  assert.equal(complete(state,task,'practice',monday,'Готово'),0);
  assert.equal(progress(state,monday).total,45);
});

test('replacement requires an explanation and preserves difficulty and workload', () => {
  const task = baseTask({ difficulty:'hard' });
  assert.throws(() => replaceTask(task,{ title:'Новая практика',reason:'Достаточно длинная причина',minutes:10 },monday),/длительность/);
  replaceTask(task,{ title:'Новая практика',reason:'Достаточно длинная причина',minutes:40 },monday);
  assert.equal(task.minutes,40);
  assert.equal(task.xp,20);
  assert.equal(task.difficulty,'hard');
  assert.throws(() => replaceTask(task,{ title:'Другое действие', reason:'Достаточно длинная причина',minutes:40 },monday),/один раз/);
});

test('reviews respect workload and priorities, remain idempotent and never award XP', () => {
  const state = fresh('UTC');
  Object.assign(state.settings,{minutes:180,autoMove:true});
  state.tasks.push(baseTask(),baseTask({id:'important',priority:'high',minutes:50}),baseTask({id:'future',date:tuesday,minutes:70}));
  state.entries.push({ id:'entry',date:monday,action:'Следующий шаг',minutes:15 });
  const review = reviewDay(state,monday);
  assert.deepEqual(review.suggestions.map(s => [s.type,s.status]),[['move','pending'],['move','automatic'],['add','pending']]);
  assert.equal(state.tasks[0].date,tuesday);
  assert.equal(state.tasks[1].date,monday);
  assert.equal(reviewDay(state,monday),review);
  assert.equal(state.reviews.length,1);
  assert.equal(state.ledger.length,0);
  const medium = review.suggestions[0];
  applySuggestion(state,medium,monday);
  assert.equal(state.tasks[1].date,tuesday);
  assert.equal(medium.status,'accepted');
  state.pauseDates.push(tuesday);
  assert.throws(() => applySuggestion(state,review.suggestions[2],monday),/времени/);
});

test('time zones, overnight schedule and day off constrain capacity', () => {
  assert.equal(day('America/Los_Angeles', new Date('2026-11-17T01:10:00Z')),monday);
  assert.equal(day('Asia/Tokyo', new Date('2026-11-16T23:10:00Z')),tuesday);
  assert.equal(shift('2026-03-29',1),'2026-03-30');
  const state = fresh('UTC');
  Object.assign(state.settings,{minutes:720,workStart:'09:00',workEnd:'18:00',sleepStart:'23:00',sleepEnd:'07:00'});
  assert.equal(plannedCapacity(state,monday),420);
  state.pauseDates.push(monday);
  assert.equal(plannedCapacity(state,monday),0);
});

test('external materials only allow HTTP and HTTPS', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://example.org/article'), 'https://example.org/article');
  assert.equal(safeUrl('https://user:secret@example.org/'), '');
});
