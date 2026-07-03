// DienstPilot Service Worker — minimaler Offline-Cache.
// Strategie: Cache-First fuer App-Shell, Network-First fuer JSON-Daten,
// NIEMALS fuer /api/* — sonst werden Server-Reads (Reviews, Plan-Sync)
// aus dem Cache beantwortet und User-Edits scheinen wieder verschwunden.
// Versionswechsel = neuer Cache-Name -> alter Cache wird beim activate geloescht.

const CACHE_VERSION = 'dienstpilot-2';
const CACHE_NAME = `dienstpilot-${CACHE_VERSION}`;

// App-Shell: was zwingend offline verfuegbar sein muss.
const APP_SHELL = [
  './',
  './index.html',
  './src/styles.css',
  './src/stats.css',
  './src/app.js',
  './src/print-duty-plan.js',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('dienstpilot-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.postMessage({ type: 'sw-activated', version: CACHE_VERSION }); } catch {}
      try { await client.navigate(client.url); } catch {}
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API-Endpoints nie cachen.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML-Navigationen: Network-First.
  const isHtmlNav = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');
  if (isHtmlNav) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  const isJson = url.pathname.endsWith('.json');
  if (isJson) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-First fuer App-Shell und Assets.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
