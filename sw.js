const CACHE = 'level-shell-v40';
const SHELL = [
 './', './index.html', './level-mobile.css', './level-advanced.js',
 './level-autopilot.js', './manifest.webmanifest', './icon.svg'
];
const shellURLs = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
const indexURL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache =>
  cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))
 ));
});

self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys
  .filter(key => key.startsWith('level-shell-') && key !== CACHE)
  .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
 const request = event.request;
 if (request.method !== 'GET') return;
 const url = new URL(request.url);
 if (request.mode === 'navigate' && shellURLs.has(url.origin + url.pathname)) {
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(indexURL)) || fetch(request)));
 } else if (shellURLs.has(url.href)) {
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
 }
});
