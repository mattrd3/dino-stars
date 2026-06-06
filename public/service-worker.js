const APP_VERSION = "v1.1.0";
const CACHE_NAME = `dino-stars-${APP_VERSION}`;
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ ok: false, offline: true, error: "Offline" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => caches.match("/offline.html")))
  );
});
