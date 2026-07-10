/**
 * PWA service worker (design doc §5/§6): cache the app shell, and serve
 * lesson/curriculum/reference GETs cache-first-with-refresh so students with
 * spotty home connectivity can keep studying. Attempts POST while offline are
 * queued by the app layer (append-only log) and replayed on reconnect.
 */
const SHELL_CACHE = 'shell-v1';
const CONTENT_CACHE = 'content-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];
const CACHEABLE_API = /\/api\/(curriculum|lessons\/|reference-sheet)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  if (CACHEABLE_API.test(url.pathname)) {
    // network-first, fall back to cache when offline
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CONTENT_CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  if (url.origin === location.origin && !url.pathname.startsWith('/api')) {
    // app shell: cache-first
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
            return res;
          }),
      ),
    );
  }
});
