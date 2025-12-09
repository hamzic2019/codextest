// Minimal PWA service worker: offline shell, light asset caching, push skeleton.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `pflegeki-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pflegeki-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const ASSET_DESTINATIONS = new Set(["style", "script", "font", "image"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (ASSET_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(cacheFirst(event.request));
  }
});

function refreshCache(request, response) {
  if (!response || response.status !== 200) return;
  caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response));
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    refreshCache(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request)
      .then((response) => refreshCache(request, response.clone()))
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    refreshCache(request, response.clone());
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "PflegeKI",
    body: "Nova obavijest.",
    url: "/",
  };

  let payload = fallback;
  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...fallback, ...data };
    } catch {
      payload = { ...fallback, body: event.data.text() || fallback.body };
    }
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
