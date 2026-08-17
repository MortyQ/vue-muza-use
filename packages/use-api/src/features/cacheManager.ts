import type { CacheOptions, InvalidateInput } from "../types";
import { parseDuration } from "../utils/time";
import { stableStringify } from "../utils/stableStringify";

export const DEFAULT_STALE_TIME = 300_000; // 5 minutes

/** Cache configuration after merging and duration parsing — durations are ms. */
export interface NormalizedCache {
    id?: string;
    staleTime: number;
    swr: boolean;
    freshFor: number;
}

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

/** Coerce a `cache` value into a partial CacheOptions (`true` → {}, `"id"` → { id }). */
function toCacheObject(cache: string | boolean | CacheOptions | undefined): CacheOptions {
    if (cache === true || cache === undefined || cache === false) return {};
    if (typeof cache === "string") return { id: cache };
    return cache;
}

/**
 * Merge the cache configuration into a resolved shape (duration strings → ms).
 *
 * Caching is active only when the request itself asks for it — a truthy
 * `optionCache` (composable-level) or `callCache` (per-call). `cacheDefaults`
 * never activates caching; it only fills fields. Per-call `cache: false`
 * disables caching for that call.
 *
 * Fields merge per-field with precedence: `cacheDefaults` < composable < per-call.
 * `id` is taken from composable/per-call only (`cacheDefaults.id` is ignored);
 * when absent the key is derived automatically by {@link resolveCacheKey}.
 */
function normalizeCacheOptions(
    optionCache: string | boolean | CacheOptions | undefined,
    callCache: string | boolean | CacheOptions | undefined,
    cacheDefaults: Partial<CacheOptions> | undefined,
): NormalizedCache | null {
    if (callCache === false) return null; // explicit per-call opt-out
    if (!optionCache && !callCache) return null; // activation gate — defaults alone never cache

    const base = toCacheObject(optionCache);
    const over = toCacheObject(callCache);
    const pick = <K extends keyof CacheOptions>(key: K): CacheOptions[K] =>
        over[key] ?? base[key] ?? cacheDefaults?.[key];

    const staleTime = pick("staleTime");
    const freshFor = pick("freshFor");

    return {
        id: over.id ?? base.id,
        staleTime: staleTime !== undefined ? parseDuration(staleTime) : DEFAULT_STALE_TIME,
        swr: pick("swr") ?? false,
        freshFor: freshFor !== undefined ? parseDuration(freshFor) : 0,
    };
}

/**
 * Resolve the concrete cache key for a request. Returns the manual `id` when set,
 * otherwise an auto key derived from method + url + params + data so that each
 * distinct params/body combination gets its own cache entry. The `auto:METHOD:url`
 * prefix supports bulk invalidation via `invalidateCache({ prefix })`.
 */
function resolveCacheKey(
    normalized: NormalizedCache,
    method: string,
    url: string,
    params: unknown,
    data: unknown,
): string {
    if (normalized.id !== undefined) return normalized.id;
    return `auto:${method.toUpperCase()}:${url}:${stableStringify(params)}:${stableStringify(data)}`;
}

/**
 * Invalidate cache entries by exact id(s) or by key prefix.
 *
 * - `string` / `string[]` — delete those exact keys.
 * - `{ prefix }` — delete every key starting with `prefix` (e.g. bust all
 *   auto-keyed pages of an endpoint). Accepts an array to bust several
 *   endpoints in one pass. Empty prefixes are dropped so they can never
 *   accidentally wipe the whole cache.
 */
function invalidateCache(input: InvalidateInput): void {
    if (typeof input === "object" && !Array.isArray(input)) {
        const prefixes = (Array.isArray(input.prefix) ? input.prefix : [input.prefix]).filter(Boolean);
        if (prefixes.length === 0) return; // empty prefix must not clear everything
        for (const key of cacheStore.keys()) {
            if (prefixes.some((prefix) => key.startsWith(prefix))) cacheStore.delete(key);
        }
        return;
    }
    const ids = Array.isArray(input) ? input : [input];
    ids.forEach((key) => cacheStore.delete(key));
}

/**
 * Clear all cache entries. Call on logout to prevent data leaks between users.
 */
function clearAllCache(): void {
    cacheStore.clear();
}

export {
    readCache,
    readCacheEntry,
    writeCache,
    invalidateCache,
    clearAllCache,
    normalizeCacheOptions,
    resolveCacheKey,
};
