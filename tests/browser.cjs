const { chromium, webkit, devices } = require('playwright');
const { join, extname } = require('node:path');
const { readFile, mkdir } = require('node:fs/promises');
const assert = require('node:assert/strict');

const contentTypes = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp', '.webmanifest':'application/manifest+json' };
const dir = join(__dirname,'..','dist');
const origin = process.env.LEVEL_TEST_URL || 'https://level.test/';
const capture = process.env.LEVEL_SCREENSHOTS || join(__dirname,'..','test-results');
const version = process.env.LEVEL_BROWSER || 'chromium';
const engine = version === 'webkit' ? webkit : chromium;

async function localApp(context) {
  if (process.env.LEVEL_TEST_URL) return;
  await context.route('https://level.test/**',async route => {
    const path = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    try {
      await route.fulfill({ status:200, body:await readFile(join(dir,path)), contentType:contentTypes[extname(path)] });
    } catch {
      await route.fulfill({status:404,body:'Missing'});
    }
  });
}

async function step(page, name) {
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();
}

async function run() {
  await mkdir(capture,{recursive:true});
  const browser = await engine.launch(version === 'chromium' ? { executablePath:'/usr/bin/chromium',args:['--no-sandbox'] } : {});
  const context = await browser.newContext({ viewport:{width:1440,height:1000}, acceptDownloads:true,serviceWorkers:process.env.LEVEL_TEST_URL ? 'allow' : 'block' });
  await localApp(context);
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading',{name:'Обзор дня',level:1}).waitFor();
  await page.screenshot({path:join(capture,version+'-dashboard.png'),fullPage:true});
  await page.getByRole('button',{name:'Настроить LEVEL'}).click();
  await page.getByLabel('Как к вам обращаться').fill('Тест');
  await page.getByRole('checkbox',{name:'Обучение'}).check();
  await step(page,'Продолжить');
  await page.getByLabel('Доступно минут в день').fill('180');
  await page.getByLabel('Первая цель').fill('Освоить анализ');
  await page.getByLabel('Первый навык').fill('Расчёты');
  await step(page,'Начать');
  await page.getByRole('heading',{name:'Привет, Тест'}).waitFor();

  await page.getByRole('link',{name:'Цели',exact:true}).click();
  await page.getByRole('button',{name:'Редактировать'}).click();
  await page.getByLabel('Этапы, по одному на строку').fill('Подготовить таблицу\nРассчитать показатели');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Подготовить таблицу'}).click();

  await page.getByRole('button',{name:'Проекты',exact:true}).click();
  await page.getByRole('button',{name:'Новый проект'}).click();
  await page.getByLabel('Название').fill('Учебный проект');
  await page.getByLabel('Этапы, по одному на строку').fill('Подготовить черновик');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Открыть',exact:true}).click();
  await page.getByRole('button',{name:'Учесть время'}).click();
  await page.getByLabel('Потрачено минут').fill('45');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Открыть',exact:true}).click();
  await page.getByText('Потрачено · 45 мин',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Подготовить черновик'}).click();
  await page.getByText('Без даты · Завершён',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();

  await page.getByRole('link',{name:'Развитие',exact:true}).click();
  await page.getByRole('button',{name:'Результаты'}).click();
  await page.getByRole('button',{name:'Настроить норматив'}).click();
  await page.getByLabel('Метрика').fill('Решённые задачи');
  await page.getByLabel('Единица').fill('примеров');
  await page.getByLabel('Целевое значение').fill('5');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Добавить замер'}).click();
  await page.getByLabel('Результат',{exact:true}).fill('5');
  await page.getByLabel('Как получен результат').fill('Решены пять контрольных примеров');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Результаты'}).click();
  await page.getByRole('button',{name:'Подтвердить результат'}).click();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByText('Норматив подтверждён',{exact:true}).waitFor();

  await page.getByRole('button',{name:'Материалы',exact:true}).click();
  await page.getByRole('button',{name:'Новый материал'}).click();
  await page.getByLabel('Название').fill('Задача на проценты');
  await page.getByLabel('Формат').selectOption('Встроенный урок');
  await page.getByLabel('Текст урока, заметки или отчёта').fill('Половина от 84 равна 42.');
  await step(page,'Сохранить');

  await page.getByRole('link',{name:'План',exact:true}).click();
  await page.getByRole('button',{name:'Новая задача'}).click();
  await page.getByLabel('Название').fill('Решить пример');
  await page.getByLabel('Описание или цель обучения').fill('Научиться рассчитывать доли.');
  await page.getByLabel('Критерий выполнения').fill('Правильный расчёт.');
  await page.getByLabel('Тип').selectOption('study');
  await page.getByLabel('Учебный материал').selectOption({label:'Задача на проценты'});
  await page.getByLabel('Контрольный вопрос').fill('Половина от 84?');
  await page.getByLabel('Точный ответ').fill('42');
  await step(page,'Сохранить');

  await page.getByRole('button',{name:'Решить пример',exact:true}).click();
  await page.getByRole('button',{name:'Заменить',exact:true}).click();
  await page.getByLabel('Новое действие').fill('Проверить формулу');
  await page.getByLabel('Что изменилось и почему эта замена подходит').fill('Таблица уже готова, можно проверить формулу.');
  await step(page,'Сохранить');
  await page.getByRole('button',{name:'Проверить формулу',exact:true}).click();
  await page.getByRole('button',{name:'Отметить изучение'}).click();
  await page.getByRole('button',{name:'Ответить на вопрос'}).click();
  await page.getByLabel('Ответ',{exact:true}).fill('42');
  await step(page,'Проверить');
  await page.getByRole('button',{name:'Завершить: Проверить формулу'}).click();
  await page.getByLabel('Подтверждение результата').fill('Расчёт проверен.');
  await step(page,'Завершить');
  await page.getByRole('button',{name:'Результат: Проверить формулу'}).waitFor();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('level-workspace-v2')));
  assert.equal((await saved()).ledger.filter(e => e.id.includes(':study') || e.id.includes(':practice') || e.id.includes(':check')).reduce((n,e) => n+e.xp,0),45);
  await page.reload();
  await page.getByRole('button',{name:'Результат: Проверить формулу'}).waitFor();

  await page.getByRole('button',{name:'Обзор дня',exact:true}).click();
  await page.getByRole('button',{name:'Запись',exact:true}).click();
  const day = await page.getByLabel('Дата',{exact:true}).inputValue();
  await page.getByLabel('Что произошло и что изменилось').fill('Нужны новые исходные данные.');
  await page.getByLabel('Следующий шаг (необязательно)').fill('Получить исходные данные');
  await step(page,'Сохранить');
  for (let count = 0; count < 2; count++) {
    await page.getByRole('button',{name:'Создать обзор',exact:true}).click();
    await page.getByLabel('Дата обзора').fill(day);
    await step(page,'Создать обзор');
    await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  assert.equal((await saved()).reviews.length,1);
  await page.getByRole('button',{name:'Принять',exact:true}).click();
  await step(page,'Применить');
  await page.getByText('Принято',{exact:true}).waitFor();
  await page.screenshot({path:join(capture,version+'-review.png'),fullPage:true});
  await page.locator('.side-nav').getByRole('link',{name:'Профиль'}).click();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  // The ephemeral WPE profile cannot persist Blob fixtures. Chromium exercises binary archives.
  if (version !== 'webkit') await page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('level-evidence-v1',1);
    request.onupgradeneeded = () => request.result.createObjectStore('files',{keyPath:'id'});
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('files','readwrite');
      tx.objectStore('files').put({ id:'test-evidence', name:'test.txt', blob:new Blob(['archived evidence'],{type:'text/plain'}) });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.getByRole('button',{name:'Сбросить данные',exact:true}).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button',{name:'Скачать копию'}).click();
  const path = await (await download).path();
  const archive = JSON.parse(JSON.parse(await readFile(path,'utf8')).content);
  if (version !== 'webkit') assert.match(archive.device.files[0].content,/^data:text\/plain;base64,/);
  await page.getByLabel('Скачанная резервная копия').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.getByLabel('Введите СБРОСИТЬ').fill('СБРОСИТЬ');
  await step(page,'Сбросить');
  await page.getByText('Копия отличается от исходных данных.',{exact:false}).waitFor();
  await page.getByLabel('Скачанная резервная копия').setInputFiles(path);
  await page.getByLabel('Введите СБРОСИТЬ').fill('СБРОСИТЬ');
  await step(page,'Сбросить');
  await page.getByRole('heading',{name:'Что для вас важно?'}).waitFor({timeout:5000}).catch(async error => { console.log(await page.locator('dialog').innerText()); throw error; });
  assert.equal(await saved(),null);
  assert.equal(await page.evaluate(() => new Promise((resolve,reject) => {
    const open = indexedDB.open('level-evidence-v1',1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const count = open.result.transaction('files').objectStore('files').count();
      count.onsuccess = () => { open.result.close(); resolve(count.result); };
      count.onerror = () => reject(count.error);
    };
  })),0);
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('heading',{name:'Обзор дня',level:1}).waitFor();

  const mobile = await browser.newContext({ ...devices['iPhone 13'], viewport:{width:320,height:700},serviceWorkers:'block' });
  await localApp(mobile);
  if (!process.env.LEVEL_TEST_URL) {
    await mobile.route('**/app/main.js',async route => {
      await new Promise(resolve => setTimeout(resolve,550));
      await route.fallback();
    });
  }
  const phone = await mobile.newPage();
  await phone.goto(origin);
  await phone.getByRole('heading',{name:'Обзор дня',level:1}).waitFor();
  await phone.getByRole('button',{name:'Переключить тему'}).click();
  assert.equal(await phone.locator('html').getAttribute('data-theme'),'light');
  await phone.screenshot({path:join(capture,version+'-mobile-light.png'),fullPage:true});
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await phone.getByRole('button',{name:'Переключить тему'}).click();
  await phone.screenshot({path:join(capture,version+'-mobile-dark.png'),fullPage:true});
  await phone.evaluate(async () => {
    const { fresh, day } = await import('./app/model.js');
    const state = fresh();
    state.tasks = Array.from({length:120},(_,index) => ({
      id:'test-' + index, title:'Очень длинное название ' + 'безПробела'.repeat(14) + index,
      date:day(state.settings.zone), xp:10, minutes:40, kind:'practice', history:[],
    }));
    localStorage.setItem('level-workspace-v2',JSON.stringify(state));
  });
  await phone.reload();
  await phone.locator('.mobile-nav').getByRole('link',{name:'План'}).click();
  await phone.getByRole('heading',{name:'План',level:1}).waitFor();
  assert.equal(await phone.locator('.task-row').count(),120);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  assert.deepEqual(failures,[]);
  await browser.close();
  console.log(version + ': onboarding, goals, skill proof, learning materials, task replacement/completion, XP, persistence, review, reset, themes and 320px viewport passed');
}
run().catch(error => { console.error(error); process.exit(1); });
