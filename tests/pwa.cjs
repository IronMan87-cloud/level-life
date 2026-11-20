const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, extname } = require('node:path');
const assert = require('node:assert/strict');

const root = join(__dirname, '..', 'dist');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.webmanifest':'application/manifest+json' };
const workerV1 = `addEventListener('install',e=>e.waitUntil(caches.open('level-shell-v40').then(c=>c.addAll(['./index.html']))));`;
const oldPage = `<script>localStorage.setItem('level-life-v1', JSON.stringify({skills:[{title:'Старые данные'}]}));navigator.serviceWorker.register('./sw.js')</script>`;
let released = false;

const server = createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname.slice('/level-life/'.length) || 'index.html';
  res.setHeader('Content-Type',types[extname(path)] || 'application/octet-stream');
  if (!released && path === 'index.html') return res.end(oldPage);
  if (!released && path === 'sw.js') return res.end(workerV1);
  try {
    res.end(await readFile(join(root,path)));
  } catch {
    res.writeHead(404).end();
  }
});

async function run() {
  await new Promise((resolve,reject) => server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/level-life/';
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    released = true;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await page.waitForFunction(async () => (await caches.keys()).includes('level-shell-2.0.0') && !(await caches.keys()).includes('level-shell-v40'));
    await page.reload();
    await page.getByRole('heading',{name:'Обзор дня',level:1}).waitFor();
    assert.equal(await page.getByText('Старые данные').count(),0);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('heading',{name:'Обзор дня',level:1}).waitFor();
    await page.getByRole('button',{name:'Настроить LEVEL'}).click();
    await page.getByRole('button',{name:'Начать без настройки'}).click();
    await page.getByRole('heading',{name:'Ваш следующий шаг'}).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('level-workspace-v2')).setup),true);
    console.log('PWA cache upgrade, legacy isolation and offline guest writes passed');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch(error => { console.error(error); process.exit(1); });
