// Service worker: aplikace (HTML/CSS/JS) funguje offline, API jde vždy na síť
// a při výpadku vrací poslední uloženou odpověď (např. seznam výletů).
const VERSION = 'tf-v3';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Network-first pro data.
    e.respondWith(fetch(request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    }).catch(() => caches.match(request).then((r) => r || new Response(JSON.stringify({ error: 'Jsi offline.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }

  // Stale-while-revalidate pro statické soubory.
  e.respondWith(caches.match(request.mode === 'navigate' ? '/index.html' : request).then((cached) => {
    const network = fetch(request).then((res) => {
      if (res.ok && request.mode !== 'navigate') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
