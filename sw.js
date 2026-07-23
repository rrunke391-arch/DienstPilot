const CACHE_VERSION = 'dienstpilot-188';
const APP_CACHE = `${CACHE_VERSION}-app`;

const CORE_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './src/styles.css',
  './src/stats.css',
  './src/auth-lock.css'
];

function isCacheableResponse(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'default'));
}

function isServerDataRequest(url) {
  return url.hostname === 'api.dienstpilot-runke.de'
    || url.pathname.includes('/api/');
}

async function precacheCoreFiles() {
  const cache = await caches.open(APP_CACHE);
  await Promise.allSettled(CORE_FILES.map(async (path) => {
    try {
      const request = new Request(path, { cache: 'reload' });
      const response = await fetch(request);
      if (isCacheableResponse(response)) await cache.put(request, response.clone());
    } catch {
      // Eine einzelne nicht erreichbare Datei darf die Installation nicht verhindern.
    }
  }));
}

async function storeSuccessfulResponse(request, response) {
  if (!isCacheableResponse(response)) return response;
  const cache = await caches.open(APP_CACHE);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheCoreFiles());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== APP_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isServerDataRequest(url)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      return storeSuccessfulResponse(request, response);
    } catch {
      const cached = await caches.match(request);
      return cached || caches.match('./index.html');
    }
  })());
});
