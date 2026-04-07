const CACHE_VERSION = "v2"
const STATIC_CACHE = `finsight-static-${CACHE_VERSION}`
const PAGES_CACHE = `finsight-pages-${CACHE_VERSION}`
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE]

const OFFLINE_URL = "/offline.html"

// Pre-cache these on install so offline fallback is always available
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return
  const { title, body, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title ?? "FinSight", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: url ?? "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return clients.openWindow(url)
      })
  )
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch Strategies ─────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)

  // API routes — always network only, no caching
  if (url.pathname.startsWith("/api/")) return

  // Vite-hashed assets (/assets/foo.abc123.js) — cache-first, they never change
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE))
    return
  }

  // Fonts — cache-first
  if (url.pathname.match(/\.(woff2?|ttf|otf)$/)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE))
    return
  }

  // Other static files (icons, images, manifest) — stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|ico|svg|webp|jpg|jpeg|gif)$/) || url.pathname === "/manifest.json") {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE))
    return
  }

  // Navigation requests (HTML pages) — network-first, cache visited pages, offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(event.request))
    return
  }
})

// ─── Strategy Helpers ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  })
  return cached ?? fetchPromise
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return caches.match(OFFLINE_URL)
  }
}
