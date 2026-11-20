const CACHE = 'level-shell-2.0.0';
const scopes = [
  'index.html', 'app/style.css', 'app/main.js', 'app/model.js', 'app/cloud.js',
  'app/ui.js', 'app/views.js', 'assets/forest.webp', 'assets/supabase.js',
  'assets/icon-192.png', 'assets/icon-512.png', 'manifest.webmanifest', 'icon.svg',
];
const absolute = relative => new URL(relative, self.registration.scope).href;
const index = absolute('index.html');
const assets = new Set(scopes.map(absolute));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...assets].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('level-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const navigation = request.mode === 'navigate' && [self.registration.scope, index].includes(path);
  if (!navigation && !assets.has(path)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(navigation ? index : path);
    return cached || fetch(request);
  }));
});
