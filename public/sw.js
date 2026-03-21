const CACHE_NAME = "finsight-v1"

// On install, take control immediately
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy: try network, fall back to cache
self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== "GET") return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Skip API routes — always go to network
  const url = new URL(event.request.url)
  if (url.pathname.startsWith("/api/")) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.match(/\.(js|css|png|ico|svg|woff2?)$/) || url.pathname === "/")) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
