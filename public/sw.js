// Service worker: makes the game work offline.
// Bump VERSION when you deploy to force every device to refresh at once
// (otherwise updates are picked up in the background on the next launch).
const VERSION = 'snek-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.json',
  'css/style.css',
  'js/main.js',
  'js/admin.js',
  'js/audio.js',
  'js/boosters.js',
  'js/bots.js',
  'js/config.js',
  'js/game.js',
  'js/heads.js',
  'js/input.js',
  'js/render.js',
  'js/skins.js',
  'js/snake.js',
  'js/storage.js',
  'js/util.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // config.json: network first so admin changes on the server show up fast.
  if (url.pathname.endsWith('/config.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('config.json', copy)); }
        return res;
      }).catch(() => caches.match('config.json')),
    );
    return;
  }

  // Everything else: serve from cache instantly, refresh in the background.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
