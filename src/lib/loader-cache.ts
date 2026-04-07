const PREFIX = "finsight:lc:"

/**
 * Wraps a route loader with localStorage caching for offline support.
 * - Online: runs the loader, persists result to localStorage
 * - Offline: returns the last cached result if available, otherwise rethrows
 *
 * Use a stable `key` per route (include route params for param routes, but
 * not search deps — we cache the last-seen data, not every filter combo).
 */
export async function withOfflineCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn()
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(result))
    } catch {
      // quota exceeded or storage unavailable — not fatal
    }
    return result
  } catch (err) {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw) {
      return JSON.parse(raw) as T
    }
    throw err
  }
}
