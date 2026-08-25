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
 *
 * It also carries notifications, which is the only way to reach a phone that
 * is locked in a pocket between sets or sitting on a table all evening.
 */

/*
 * Bumping this drops every cache the previous version left behind, which is
 * what the `activate` handler below uses it for. It has to move whenever the
 * document's own markup changes — the pages cache holds whole HTML documents,
 * and a stale one carries stale `<head>` metadata with it. That is exactly how
 * a phone can go on behaving as though a change to the head never shipped.
 */
const VERSION = "gym-v2";
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


/* ------------------------------------------------------------ notifications */

self.addEventListener("push", (event) => {
  let message = { title: "GYM", body: "" };
  try {
    if (event.data) message = { ...message, ...event.data.json() };
  } catch {
    // A payload that will not parse is still worth showing as a nudge.
  }

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces rather than stacks: nobody wants six of these.
      tag: message.tag || "gym",
      renotify: true,
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse the window that is already open rather than stacking tabs.
      for (const client of clients) {
        if (new URL(client.url).origin === target.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
