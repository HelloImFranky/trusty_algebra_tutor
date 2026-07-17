/**
 * PWA service worker (design doc §5/§6): keep students with spotty home
 * connectivity studying, without ever pinning them to a stale build.
 *
 * - navigations + cacheable API GETs: network-first, cache fallback offline
 * - hashed build assets (/_next/static): cache-first (immutable by name)
 * - other static files (images, manifest, scaffold jpgs): stale-while-
 *   revalidate — served from cache for speed, refreshed in the background
 *   so the next visit picks up redeployed content
 *
 * Bump the version when the caching strategy changes so activate() drops
 * every cache written by older workers. Attempts to POST while offline are
 * queued by the app layer (append-only log) and replayed on reconnect.
 */
const VERSION = 'v3';
const SHELL_CACHE = `shell-${VERSION}`;
const CONTENT_CACHE = `content-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];
// Only cache genuinely public, user-INDEPENDENT API responses. The reference
// sheet is the same for everyone. Never add a per-user endpoint here: this
// cache is shared across every user of the device, so a personalized response
// (mastery, progress, roster) cached for one account would be served to the
// next — a cross-user data leak. Per-user data must stay network-only.
const CACHEABLE_API = /\/api\/reference-sheet(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== CONTENT_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request, cacheName) {
  return fetch(request)
    .then((res) => {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(request, copy));
      return res;
    })
    .catch(() => caches.match(request));
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then(
    (hit) =>
      hit ??
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
        return res;
      }),
  );
}

function staleWhileRevalidate(request, cacheName) {
  return caches.match(request).then((hit) => {
    const refresh = fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => hit);
    return hit ?? refresh;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (CACHEABLE_API.test(url.pathname)) {
    event.respondWith(networkFirst(request, CONTENT_CACHE));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith('/api')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});
