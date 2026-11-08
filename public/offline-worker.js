/* Cache app assets only. Authenticated APIs and table snapshots never enter this cache. */
const CACHE = "draw-steel-app-v1";
const cacheable = url => url.origin === self.location.origin && !url.pathname.startsWith("/api/") && /\.(?:js|css|woff2|json|png|svg|webp)$/.test(url.pathname);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request("./index.html", { cache: "reload" }))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_ASSETS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(event.data.urls.slice(0, 500).filter(value => {
    try { return cacheable(new URL(value, self.location.href)); } catch { return false; }
  }).map(url => cache.add(url)))));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put("./index.html", copy))); }
      return response;
    }).catch(() => caches.match("./index.html").then(response => response || Response.error())));
  } else if (cacheable(url)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
      return response;
    })));
  }
});
