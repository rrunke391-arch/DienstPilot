const CACHE_VERSION = 'dienstpilot-153';
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

async function cachedResponse(request) {
  return (await caches.match(request))
    || (await caches.match(request, { ignoreSearch: true }));
}

async function navigationFallback(request) {
  return (await cachedResponse(request))
    || (await caches.match('./index.html', { ignoreSearch: true }))
    || (await caches.match('./', { ignoreSearch: true }))
    || new Response(
      '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DienstPilot offline</title><body><h1>DienstPilot ist zurzeit offline</h1><p>Bitte stelle kurz eine Internetverbindung her und öffne die App erneut.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    return storeSuccessfulResponse(request, response);
  } catch {
    const cached = await cachedResponse(request);
    if (cached) return cached;
    throw new Error('Netzwerk und Cache nicht verfügbar');
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await precacheCoreFiles();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== APP_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'sw-activated', version: CACHE_VERSION });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Dienstplan-, Benutzer- und Werkstattdaten werden niemals im PWA-Cache gespeichert.
  if (isServerDataRequest(url)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        return storeSuccessfulResponse(request, response);
      } catch {
        return navigationFallback(request);
      }
    })());
    return;
  }

  event.respondWith(networkFirst(request).catch(() => new Response('', { status: 504 })));
});
