/* LEVEL Autopilot — generated profile, goal roadmaps and automatic next actions. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const norm=s=>String(s||'').toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const safe=s=>esc(String(s??''));
 const localDate=d=>{const x=d?new Date(d):new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
 const datePlus=(base,n)=>{const p=String(base||today()).split('-').map(Number),d=new Date(p[0],p[1]-1,p[2],12);d.setDate(d.getDate()+n);return localDate(d)};
 function roadmapForGoal(g){
  const t=norm(g.title);
  if(t.includes('150 000')||t.includes('стабильный доход'))return [
   {title:'Подготовить профиль для удалённой работы',detail:'Собрать резюме и описание опыта в продажах, CRM, переговорах и поддержке. Отсеять вакансии с постоянным холодным обзвоном.',proof:'Готово резюме и 3 конкретных примера сильных сторон.',minutes:45},
   {title:'Собрать 10 подходящих удалённых вакансий',detail:'Сравнить обязанности, оплату, график и реальные условия.',proof:'Есть список из 10 вакансий со ссылками и статусами.',minutes:60},
   {title:'Отправить 3 адресных отклика',detail:'Адаптировать сопроводительное сообщение под каждую вакансию.',proof:'Сохранены 3 отправленных отклика и даты.',minutes:45},
   {title:'Подготовиться к собеседованиям и пройти интервью',detail:'Отработать рассказ о себе, CRM, возражениях и работе с клиентами.',proof:'Записаны 5 ответов и итоги хотя бы одного интервью.',minutes:60},
   {title:'Закрепить стабильный доход и составить план до 150 000 ₽',detail:'Учитывать только фактические выплаты; рассчитать недостающую сумму и дополнительный источник.',proof:'Есть подтверждённый источник дохода и помесячный план роста.',minutes:60}
  ];
  if(t.includes('300 000')||t.includes('систему дохода'))return [
   {title:'Составить список из 10 проблем потенциальных клиентов',detail:'Начать со знакомых областей: продажи, CRM, поддержка и автоматизация.',proof:'Есть 10 проблем с типом клиента и частотой возникновения.',minutes:45},
   {title:'Исследовать 5 конкурирующих решений',detail:'Сравнить аудиторию, цену, отзывы, слабые места и привлечение клиентов.',proof:'Есть сравнение 5 конкурентов и 3 возможности для отличия.',minutes:60},
   {title:'Поговорить с 5 потенциальными покупателями',detail:'Выяснить, как они решают проблему сейчас и за что уже платят.',proof:'Записаны 5 разговоров и повторяющиеся проблемы.',minutes:90},
   {title:'Проверить спрос и собрать минимальную версию продукта',detail:'Сначала проверить предложение, затем сделать только необходимую функцию MVP.',proof:'Есть измеренный отклик аудитории и прототип, который можно показать.',minutes:120},
   {title:'Получить первые оплаты и проверить экономику',detail:'Согласовать результат и цену; учесть комиссии, время, инфраструктуру и поддержку.',proof:'Есть первые платные клиенты и расчёт положительной юнит-экономики.',minutes:120}
  ];
  if(t.includes('jarvis')||t.includes('автономного агента'))return [
   {title:'Зафиксировать текущую архитектуру и незакрытые риски Jarvis',detail:'Собрать схему компонентов, прав доступа и список оставшихся тестов без повторного аудита уже закрытого.',proof:'Есть актуальная схема и список непроверенных рисков.',minutes:45},
   {title:'Завершить Permission Engine и Approval Manager',detail:'Проверить личность одобряющего, IPC и блокировку опасных действий без разрешения.',proof:'Критические тесты проходят; действие без одобрения блокируется.',minutes:90},
   {title:'Проверить сохранение состояния и восстановление после перезапуска',detail:'Протестировать журнал, незавершённые задачи и загрузку состояния.',proof:'Тест перезапуска проходит без потери состояния.',minutes:60},
   {title:'Запустить безопасное исследование рынка',detail:'Собирать источники, отделять факты от гипотез и сравнивать конкурентов.',proof:'Есть отчёт с источниками и проверяемыми выводами.',minutes:90},
   {title:'Создать продуктовый эксперимент и проверить окупаемость',detail:'Собрать MVP, получить обратную связь и сопоставить доход с расходами на модели, GPU и инфраструктуру.',proof:'Есть реакция потенциальных клиентов и расчёт экономики; реальные траты — только после одобрения.',minutes:120}
  ];
  if(t.includes('качество жизни')||t.includes('lancer')||t.includes('квартир'))return [
   {title:'Собрать реальную картину ежемесячного бюджета',detail:'Внести обязательные расходы, долги и доступный остаток.',proof:'Есть полный список расходов и свободный остаток.',minutes:40},
   {title:'Составить план погашения обязательств и финансовой подушки',detail:'Определить безопасный ежемесячный платёж и минимальный резерв.',proof:'Есть план с суммами и сроками без учёта неподтверждённых поступлений.',minutes:45},
   {title:'Оценить варианты двухкомнатной квартиры и бюджет переезда',detail:'Сравнить 5 вариантов, депозит, коммунальные расходы и транспорт.',proof:'Есть сравнение вариантов и полная стоимость переезда.',minutes:60},
   {title:'Рассчитать бюджет путешествия, кота и Lancer X',detail:'Учесть содержание, ветеринарию, поездку, диагностику и ремонтный резерв автомобиля.',proof:'Есть отдельные бюджеты и последовательность накоплений.',minutes:60}
  ];
  if(t.includes('долг')||t.includes('финансовой устойчивости'))return [
   {title:'Собрать полный реестр долгов и обязательств',detail:'Для каждого указать остаток, ставку, минимальный платёж и дату.',proof:'Есть единый список с проверенными суммами.',minutes:30},
   {title:'Определить очерёдность погашения',detail:'Исключить просрочки и штрафы, затем сравнить стоимость каждого долга.',proof:'Для каждого долга определена очередность и причина.',minutes:40},
   {title:'Составить посильный график платежей',detail:'Использовать подтверждённый доход и обязательные расходы.',proof:'Есть месячный график без расчёта на ожидаемые, но не полученные деньги.',minutes:35},
   {title:'Проводить ежемесячную сверку и закрыть обязательства',detail:'Обновлять остатки после платежей, сохранять подтверждения и затем создать резерв.',proof:'Есть подтверждения погашения и первая сумма резерва.',minutes:30}
  ];
  return [];
 }
 function genericRoadmap(){return [
  {title:'Определить измеримый конечный результат',detail:'Сформулировать, что изменится и как это проверить.',proof:'Есть метрика и критерий завершения.',minutes:25},
  {title:'Разбить цель на последовательные этапы',detail:'Каждый этап должен иметь понятный результат.',proof:'Составлен порядок действий.',minutes:35},
  {title:'Выполнить первый практический шаг',detail:'Выбрать действие, которое можно закончить за один рабочий блок.',proof:'Есть артефакт или измеримый результат.',minutes:45},
  {title:'Проверить прогресс и устранить главное препятствие',detail:'Сравнить факт с планом и скорректировать следующий шаг.',proof:'Зафиксированы прогресс и следующий шаг.',minutes:25}
 ]}
 function ensureGoalTask(g,preferredDate){
  const next=(g.milestones||[]).find(m=>!m.done);if(!next)return false;
  if(db.tasks.some(t=>t.goal===g.id&&t.milestoneId===next.id&&!t.replaced))return false;
  const previous=db.tasks.filter(t=>t.goal===g.id&&t.source==='goal-roadmap').sort((a,b)=>(a.date||'').localeCompare(b.date||'')).pop();
  let date=preferredDate||datePlus(today(),1);if(previous&&previous.date>=date)date=datePlus(previous.date,1);
  db.tasks.push({id:id(),title:next.title,date,time:'',priority:'Высокий',done:false,rewarded:false,goal:g.id,milestoneId:next.id,source:'goal-roadmap',difficulty:'Средняя',duration:(next.minutes||30)+' минут',proof:next.proof||'Зафиксируй конкретный результат.'});
  return true;
 }
 function ensureAutopilotData(){
  let changed=false;
  db.goals.forEach((g,index)=>{
   if(Number(g.goalPlanVersion||0)<2){
    const old=Array.isArray(g.milestones)?g.milestones:[],template=roadmapForGoal(g);
    if(template.length&&!old.some(m=>m.done))g.milestones=template.map((m,i)=>({...m,id:old[i]?.id||id(),done:false}));
    else if(!old.length)g.milestones=genericRoadmap().map(m=>({...m,id:id(),done:false}));
    else g.milestones=old.map(m=>({...m,detail:m.detail||'Выполни этап и зафиксируй результат.',proof:m.proof||'Есть измеримый результат или подтверждение.'}));
    g.goalPlanVersion=2;g.progress=Math.round(g.milestones.filter(m=>m.done).length/Math.max(1,g.milestones.length)*100);changed=true;
   }
   if(ensureGoalTask(g,datePlus(today(),index+1)))changed=true;
  });
  const plans=[
   ['jarvis',['Проверить актуальные тесты и незакрытые ошибки','Завершить и проверить Approval Manager','Проверить восстановление состояния после перезапуска','Запустить безопасное исследование рынка','Провести тест одной бизнес-возможности']],
   ['поиск стабильного удалённого дохода',['Подготовить резюме под удалённые роли','Собрать 10 вакансий без постоянного холодного обзвона','Отправить 3 адресных отклика','Подготовить ответы и пройти тренировочное собеседование','Сравнить предложения по оплате и условиям']],
   ['собственный интернет продукт',['Собрать 10 проблем клиентов','Сравнить 5 конкурентов','Провести 5 интервью с покупателями','Проверить спрос простым предложением','Собрать MVP и получить первые оплаты']],
   ['level',['Автоматизировать путь от цели до конкретного квеста','Создать автопрофиль из данных пользователя','Сократить пустые состояния и лишнюю навигацию','Проверить работу на iPhone Safari и синхронизацию']]
  ];
  db.projects.forEach(p=>{
   if(!Array.isArray(p.steps))p.steps=[];
   if(!p.steps.length){const key=norm(p.title),match=plans.find(([k])=>key.includes(k)),titles=match?match[1]:['Определить измеримый результат','Разбить работу на этапы','Выполнить первый этап','Проверить и зафиксировать результат'];p.steps=titles.map(title=>({id:id(),title,done:false}));p.nextStep=titles[0];p.plannedMinutes=titles.length*45;changed=true}
   else if(!p.nextStep){p.nextStep=p.steps.find(s=>!s.done)?.title||'';changed=true}
  });
  const profile={generated:true,version:1,updatedAt:today(),summary:'Коммерческий профиль с фокусом на удалённую работу, собственные интернет-продукты и развитие Jarvis.',experience:'Продажи и переговоры, CRM, работа с возражениями; английский язык и базовый нидерландский.',workPreference:'Предпочтение — удалённая занятость без постоянной рутины холодных звонков, чтобы сохранять время и силы на собственные проекты.',principles:['Проверять спрос и конкурентов до серьёзных вложений.','Развивать Jarvis с контролем разрешений и подтверждением опасных действий.','До масштабирования добиваться экономики, при которой доход выше расходов на модели, GPU и инфраструктуру.','Не проводить реальные траты и финансовые сделки без явного одобрения.']};
  if(!db.profile||db.profile.version!==1){db.profile=profile;changed=true}
  else db.profile={...profile,...db.profile,updatedAt:today()};
  if(changed){localStorage.setItem('level-life-v1',JSON.stringify(db));if(typeof markLocalChange==='function')markLocalChange()}
  return changed;
 }
 function renderAutopilot(){
  const profile=$('homeProfile'),next=$('homeNextSteps');if(!profile||!next)return;
  const p=db.profile||{},skills=db.skills.map(s=>s.title);
  profile.innerHTML='<div class="eyebrow">Автопрофиль · обновляется автоматически</div><h3>'+safe(p.summary||'Твой личный маршрут')+'</h3><p class="sub"><b>Опыт:</b> '+safe(p.experience||'Данные собраны из навыков и проектов.')+'</p><p class="sub"><b>Формат работы:</b> '+safe(p.workPreference||'')+'</p><div>'+skills.slice(0,8).map(s=>'<span class="autoprofile-chip">'+safe(s)+'</span>').join('')+'</div><div class="goal-step-detail" style="margin-top:10px"><b>Принципы:</b> '+(p.principles||[]).slice(0,3).map(safe).join(' · ')+'</div><p class="goal-step-detail">Профиль основан на ранее указанных предпочтениях и данных LEVEL; приложение не придумывает выполненные результаты.</p>';
  const upcoming=db.tasks.filter(t=>t.source==='goal-roadmap'&&!t.done&&!t.replaced).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,5);
  next.innerHTML=upcoming.map(t=>{const g=db.goals.find(x=>x.id===t.goal);return '<div class="task"><div class="tasktext"><strong>'+safe(t.title)+'</strong><div class="taskmeta"><span>'+safe(g?.title||'Большая цель')+'</span><span>'+safe(t.date)+'</span><span>'+safe(t.duration)+'</span></div><div class="taskproof">Готово, когда: '+safe(t.proof||'результат зафиксирован')+'</div></div></div>'}).join('')||'<div class="empty">Все ближайшие шаги закрыты. Следующий появится после обновления плана.</div>';
 }
 const oldRender=window.render;
 if(typeof oldRender==='function')window.render=function(){oldRender();renderAutopilot()};
 const oldTask=window.toggleTask;
 if(typeof oldTask==='function')window.toggleTask=function(tid){
  const t=db.tasks.find(x=>x.id===tid);if(!t)return;
  const wasDone=!!t.done;oldTask(tid);
  let changed=false;
  if(!wasDone&&t.done&&t.goal&&t.milestoneId){
   const g=db.goals.find(x=>x.id===t.goal),m=g?.milestones?.find(x=>x.id===t.milestoneId);
   if(m&&!m.done){m.done=true;g.progress=Math.round(g.milestones.filter(x=>x.done).length/Math.max(1,g.milestones.length));changed=true}
   if(g&&ensureGoalTask(g,datePlus(t.date||today(),1)))changed=true;
  }else if(wasDone&&!t.done&&t.goal&&t.milestoneId){
   const g=db.goals.find(x=>x.id===t.goal),m=g?.milestones?.find(x=>x.id===t.milestoneId);
   if(m&&m.done){m.done=false;g.progress=Math.round(g.milestones.filter(x=>x.done).length/Math.max(1,g.milestones.length));changed=true}
  }
  if(changed){localStorage.setItem('level-life-v1',JSON.stringify(db));if(typeof markLocalChange==='function')markLocalChange();if(typeof render==='function')render()}
 };
 const oldMilestone=window.toggleMilestone;
 if(typeof oldMilestone==='function')window.toggleMilestone=function(gid,mid){
  const g=db.goals.find(x=>x.id===gid),m=g?.milestones?.find(x=>x.id===mid);if(!g)return oldMilestone(gid,mid);
  oldMilestone(gid,mid);
  const linked=db.tasks.find(t=>t.goal===gid&&t.milestoneId===mid&&!t.replaced);
  if(m?.done&&linked&&!linked.done){linked.done=true;linked.manualCompleted=true}
  if(!m?.done&&linked?.manualCompleted){linked.done=false;delete linked.manualCompleted}
  if(m?.done)ensureGoalTask(g,datePlus(today(),1));
  localStorage.setItem('level-life-v1',JSON.stringify(db));if(typeof markLocalChange==='function')markLocalChange();render();
 };
 const oldAddGoal=window.addGoal;
 if(typeof oldAddGoal==='function')window.addGoal=function(){oldAddGoal();const g=db.goals[db.goals.length-1];if(g){g.createdAt=today();g.goalPlanVersion=0;ensureAutopilotData();render()}};
 const oldAddProject=window.addProject;
 if(typeof oldAddProject==='function')window.addProject=function(){oldAddProject();ensureAutopilotData();render()};
 const oldAddAdvancedProject=window.addProjectAdvanced;
 if(typeof oldAddAdvancedProject==='function')window.addProjectAdvanced=function(){oldAddAdvancedProject();ensureAutopilotData();render()};
 const oldDownload=window.downloadCloudSnapshot;
 if(typeof oldDownload==='function')window.downloadCloudSnapshot=function(row){oldDownload(row);ensureAutopilotData();render()};
 window.ensureAutopilotData=ensureAutopilotData;
 window.renderAutopilot=renderAutopilot;
 ensureAutopilotData();
 if(typeof render==='function')render();else renderAutopilot();
})();