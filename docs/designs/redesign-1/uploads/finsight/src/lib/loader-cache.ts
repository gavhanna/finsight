const PREFIX = "finsight:lc:";

function getStorage(): Storage | null {
  try {
    const s = typeof window !== "undefined" ? window.localStorage : null;
    return s && typeof s.getItem === "function" ? s : null;
  } catch {
    return null;
  }
}

/**
 * Wraps a route loader with localStorage caching for offline support.
 * - Online: runs the loader, persists result to localStorage
 * - Offline: returns the last cached result if available, otherwise rethrows
 *
 * Use a stable `key` per route (include route params for param routes, but
 * not search deps — we cache the last-seen data, not every filter combo).
 */
export async function withOfflineCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const storage = getStorage();

  // If we already know we're offline, skip the network call entirely and serve
  // from cache immediately — avoids failed requests and console noise from
  // TanStack Start's internal serverFnFetcher logging
  if (storage && typeof navigator !== "undefined" && !navigator.onLine) {
    const raw = storage.getItem(PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  }

  try {
    const result = await fn();
    try {
      getStorage()?.setItem(PREFIX + key, JSON.stringify(result));
    } catch {
      // quota exceeded or storage unavailable — not fatal
    }
    return result;
  } catch (err) {
    // Fallback for cases where onLine was true but the request still failed
    // (e.g. connected to WiFi but no actual internet)
    const raw = getStorage()?.getItem(PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
    throw err;
  }
}
