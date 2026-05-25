const CACHE_NAME = "volimto-v1";
const STATIC_CACHE = "volimto-static-v1";
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const IS_DEV_HOST = DEV_HOSTS.has(self.location.hostname);

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /\/fonts\//,
  /\/portraits\//,
  /\.woff2?$/,
  /\.ttf$/,
];

const NETWORK_FIRST_PATTERNS = [
  /^\/api\//,
];

function isStatic(url) {
  return STATIC_PATTERNS.some((pattern) => pattern.test(url));
}

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url));
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (IS_DEV_HOST) return caches.delete(k);
            if (k !== CACHE_NAME && k !== STATIC_CACHE) return caches.delete(k);
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_DEV_HOST) return;

  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or known CDN requests
  if (request.method !== "GET") return;

  const pathname = url.pathname;

  if (isStatic(pathname)) {
    // Cache-first for static assets
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  if (isNetworkFirst(pathname)) {
    // Network-first for API routes
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(JSON.stringify({ error: "offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
        )
      )
    );
    return;
  }

  // Network-first for pages, fall back to cache, then offline message
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(
              `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8"><title>Offline — VolímTo</title>
<style>body{font-family:serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F4F3EE;color:#111110;}
.box{text-align:center;padding:2rem;}h1{font-size:2rem;margin-bottom:1rem;}p{color:#555;}</style></head>
<body><div class="box"><h1>VolímTo</h1><p>Ste offline. Skontrolujte pripojenie na internet a skúste to znova.</p></div></body>
</html>`,
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
        )
      )
  );
});
