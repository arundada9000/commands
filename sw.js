/* ------------------------------------------------------------------ */
/*  Command Deck: Progressive Web App Service Worker                   */
/*  Enables full offline capability, asset caching, and fast returns   */
/* ------------------------------------------------------------------ */

const CACHE_VERSION = 'command-deck-v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/img/logo.svg',
  './assets/img/code-night.webp',
  './assets/fonts/spacegrotesk-500.woff2',
  './assets/fonts/spacegrotesk-700.woff2',
  './assets/fonts/jetbrains-mono-500.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Precaching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // For same-origin navigation requests: serve cached index.html if network is unavailable
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // Cache-first for fonts and static image assets
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          const cloned = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, cloned));
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for other requests
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
