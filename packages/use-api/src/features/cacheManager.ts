export const DEFAULT_STALE_TIME = 300_000; // 5 minutes

interface CacheEntry<T = unknown> {
    data: T;
    cachedAt: number;
    staleTime: number;
}

// Module-level singleton — one Map for the entire app.
// All useApi instances share the same cache.
const cacheStore = new Map<string, CacheEntry>();

/**
 * Read a cache entry together with its age in milliseconds.
 * Returns null if the entry is missing or expired (expired entries are
 * deleted immediately on read). The age lets callers apply their own
 * freshness policy (e.g. CacheOptions.freshFor) at read time.
 */
function readCacheEntry<T>(id: string): { data: T; ageMs: number } | null {
    const entry = cacheStore.get(id) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const ageMs = Date.now() - entry.cachedAt;
    if (ageMs >= entry.staleTime) {
        cacheStore.delete(id);
        return null;
    }
    return { data: entry.data, ageMs };
}

/**
 * Read a cache entry. Returns data if valid, null if stale or missing.
 * Expired entries are deleted immediately on read.
 */
function readCache<T>(id: string): T | null {
    return readCacheEntry<T>(id)?.data ?? null;
}

/**
 * Write a cache entry after a successful request.
 */
function writeCache<T>(id: string, data: T, staleTime: number): void {
    cacheStore.set(id, { data, cachedAt: Date.now(), staleTime });
}

/**
 * Invalidate one or multiple cache entries by id.
 */
function invalidateCache(id: string | string[]): void {
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach((key) => cacheStore.delete(key));
}

/**
 * Clear all cache entries. Call on logout to prevent data leaks between users.
 */
function clearAllCache(): void {
    cacheStore.clear();
}

export { readCache, readCacheEntry, writeCache, invalidateCache, clearAllCache };
