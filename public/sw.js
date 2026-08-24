/*
 * Service worker.
 *
 * Two jobs only: make the application installable, and let it open with no
 * connection. Static assets and exercise artwork are served from the cache
 * first — they never change without their URL changing. Pages are fetched from
 * the network first and fall back to the last copy seen, so arriving at the
 * gym with no signal still opens the app on whatever was last loaded.
 *
 * Nothing else is touched: writes go through the application's own offline
 * queue, which owns the retry.
 */

const VERSION = "gym-v1";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/catalogue/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES));
  }
});
