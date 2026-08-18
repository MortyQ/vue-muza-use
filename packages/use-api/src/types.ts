import type { AxiosRequestConfig, AxiosResponse, AxiosInstance } from "axios";
import type {MaybeRefOrGetter, Ref, WatchSource} from "vue";

export interface ApiError {
    message: string;
    status: number;
    code?: string;
    errors?: Record<string, string[]>;
    details?: unknown;
}

export type AuthMode = "default" | "public" | "optional";

/**
 * Human-readable duration string: a number followed by a unit.
 * Supported units: `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours), `d` (days).
 *
 * @example "500ms" · "30s" · "5m" · "1.5h" · "1d"
 */
export type DurationString = `${number}ms` | `${number}s` | `${number}m` | `${number}h` | `${number}d`;

/**
 * A duration in milliseconds, or a {@link DurationString} like `"5m"` / `"1h"`.
 */
export type DurationInput = number | DurationString;

export interface CacheOptions {
    /**
     * Explicit cache key. **Optional** — when omitted, the key is derived
     * automatically at request time from `method + url + params + data`, so each
     * distinct set of query params / request body gets its own cache entry
     * (ideal for paginated or filtered lists). Provide `id` to opt out of
     * auto-keying and pin a stable manual key.
     *
     * `cache: true` and `cache: {}` are equivalent: auto-key + defaults.
     */
    id?: string;
    /**
     * How long the cached entry is valid — milliseconds or a duration string (`"5m"`, `"1h"`, `"1d"`).
     * Default: 300_000 (5 minutes)
     */
    staleTime?: DurationInput;
    /**
     * Stale-while-revalidate: serve cached data instantly while revalidating in the background.
     * On a cache hit, data is set immediately (no loading state) and a fresh request runs silently.
     * The `revalidating` ref is `true` during the background fetch.
     *
     * On a cache miss the request behaves normally (loading: true).
     *
     * @example
     * ```ts
     * const { data, revalidating } = useApi('/users', {
     *   cache: { id: 'users', swr: true },
     *   immediate: true,
     * })
     * // Template: <span v-if="revalidating">↻</span>
     * ```
     */
    swr?: boolean;
    /**
     * Age below which a cached entry is "fresh": served WITHOUT background
     * revalidation even when `swr: true`. Milliseconds or a duration string.
     * Only meaningful together with `swr: true` (non-SWR hits already skip
     * the network for the whole `staleTime` window).
     *
     * Default: 0 — every SWR hit revalidates.
     *
     * @example
     * ```ts
     * // Instant display; network at most once an hour; loading spinner only
     * // after a day (or after an explicit invalidateCache('report')).
     * useApi('/daily-report', {
     *   cache: { id: 'report', swr: true, freshFor: '1h', staleTime: '1d' },
     *   immediate: true,
     * })
     * ```
     */
    freshFor?: DurationInput;
}

/**
 * Accepted input for cache invalidation.
 * - `string` / `string[]` — delete exact cache key(s).
 * - `{ prefix }` — delete every key starting with `prefix`. Handy for busting
 *   all auto-keyed variations of an endpoint at once, e.g.
 *   `{ prefix: "auto:GET:/products" }` clears every cached page/filter combo.
 *   Pass an array to bust several endpoints in one call. Empty prefixes are
 *   ignored, so they can never accidentally wipe the whole cache.
 *
 * @example
 * ```ts
 * invalidateCache({ prefix: ["auto:GET:/products", "auto:GET:/categories"] });
 * ```
 */
export type InvalidateInput = string | string[] | { prefix: string | string[] };

export interface ApiState<T = unknown> {
    data: T | null
    loading: boolean
    error: ApiError | null
    statusCode: number | null
}

export interface ApiRequestConfig<D = unknown, P = unknown> extends Omit<AxiosRequestConfig<D>, "data" | "params"> {
    data?: MaybeRefOrGetter<D> | D;
    params?: MaybeRefOrGetter<P> | P;
    skipErrorNotification?: boolean;
    authMode?: AuthMode;
    retry?: boolean | number;
    retryDelay?: number;
    /**
     * Retry only when the response status code is in this list.
     * Default: [408, 429, 500, 502, 503, 504]
     * Empty array = retry on any error (network errors included).
     */
    retryStatusCodes?: number[];
    /**
     * Include credentials (cookies, Authorization headers) in cross-origin requests.
     *
     * Supports three auth strategies:
     *
     * **1. Bearer token (default)** — tokens in localStorage, no cookies needed:
     * ```ts
     * createApiClient({ baseURL: '/api' }) // withCredentials: false by default
     * ```
     *
     * **2. Full cookie-based auth** — server sets httpOnly cookies for both tokens:
     * ```ts
     * createApiClient({ baseURL: '/api', withCredentials: true })
     * ```
     *
     * **3. Hybrid** — Bearer access token + httpOnly refresh cookie:
     * ```ts
     * createApiClient({
     *   baseURL: '/api',
     *   authOptions: { refreshWithCredentials: true } // cookies only on /auth/refresh
     * })
     * ```
     *
     * **Per-request override** — override the global setting for a specific request:
     * ```ts
     * // Global: withCredentials: false, but this endpoint needs cookies
     * const { data } = useApi('/user/profile', { withCredentials: true })
     *
     * // Global: withCredentials: true, but skip cookies for public CDN
     * const { data } = useApi('https://cdn.example.com/config.json', {
     *   withCredentials: false,
     *   immediate: true
     * })
     * ```
     */
    withCredentials?: boolean;
}

export interface UseApiOptions<T = unknown, D = unknown, TSelected = T> extends ApiRequestConfig<D> {
    immediate?: boolean;
    onSuccess?: (response: AxiosResponse<T>) => void;
    onError?: (error: ApiError) => void;
    onBefore?: () => void;
    onFinish?: () => void;
    /**
     * Transform the raw response data before it is stored in `data`.
     * Applied on every successful response — including polling, SWR revalidation,
     * and watch-triggered re-fetches. The cache always stores the raw server data;
     * `select` is re-applied each time data is read from cache.
     *
     * The second generic parameter of `useApi` becomes the output type of `select`.
     *
     * @example
     * ```ts
     * // Extract nested field
     * const { data } = useApi<ApiResponse, User[]>('/users', {
     *   select: (res) => res.data,
     * })
     *
     * // Transform items
     * const { data } = useApi<RawUser[], User[]>('/users', {
     *   select: (users) => users.map(u => ({ ...u, fullName: `${u.first} ${u.last}` })),
     * })
     * ```
     */
    select?: (data: T) => TSelected;
    initialData?: TSelected;
    debounce?: number;
    useGlobalAbort?: boolean;
    initialLoading?: boolean;
    /**
     * Disable auto-tracking. When true, reactive changes to `url`, `params`,
     * and `data` will NOT trigger a re-fetch. Use for forms or manual mutations
     * where you want full control over when `execute()` is called.
     */
    lazy?: boolean;
    /**
     * Coalesce auto-tracked triggers. When several reactive deps change within
     * one flush (e.g. a filter change plus a watcher that resets page/sort),
     * a single request is sent after the flush with the final getter values —
     * instead of one request per trigger, where earlier ones are aborted but
     * still hit the server.
     *
     * Applies to auto-tracking, the `immediate` initial request, and dynamic
     * `poll` config changes. Manual `execute()` calls are never coalesced and
     * supersede any pending auto-triggered send in the same tick.
     *
     * Default: `true`. Set `false` to restore the pre-1.7 per-trigger behavior.
     * Can be set globally via `createApi({ globalOptions: { coalesce: false } })`;
     * the per-request value takes precedence.
     */
    coalesce?: boolean;
    /**
     * Re-fetch when the browser tab regains focus (`visibilitychange` event).
     *
     * - `true` — use default throttle of 60 000ms (prevents rapid refetches on quick tab switches)
     * - `{ throttle: number }` — custom throttle in ms. Pass `0` to always refetch on focus.
     *
     * No refetch fires if a request is already in-flight (`loading: true`).
     * Compatible with `lazy: true` — focus is a browser trigger, not a reactive dep.
     * Compatible with `poll` — both register separate listeners; `!loading` guard prevents duplicates.
     *
     * Can be set globally via `createApi({ axios, globalOptions: { refetchOnFocus: true } })`.
     * Per-request value takes precedence over global (including `false` to opt-out).
     */
    refetchOnFocus?: boolean | { throttle?: number };
    /**
     * Re-fetch when the browser regains network connectivity (`online` event).
     *
     * No throttle is applied — reconnect is already a rare event.
     * No refetch fires if a request is already in-flight (`loading: true`).
     *
     * Can be set globally via `createApi({ axios, globalOptions: { refetchOnReconnect: true } })`.
     * Per-request value takes precedence over global (including `false` to opt-out).
     */
    refetchOnReconnect?: boolean;
    /**
     * Cache the response data.
     * - `cache: true` / `cache: {}` — auto-key from `method + url + params + data`
     *   (each distinct params/body gets its own entry) + any `cacheDefaults`.
     * - String shorthand: `cache: 'key'` — manual key, defaults for the rest.
     * - Object form: `cache: { id: 'key', staleTime: 10_000 }` — manual key + custom fields.
     *   Omit `id` (`cache: { swr: true }`) to auto-key while overriding specific fields.
     *
     * Fields resolve per-field with precedence: `globalOptions.cacheDefaults`
     * < composable `cache` < per-call `execute({ cache })`.
     *
     * On cache hit: mutate() is called with cached data, loading stays false,
     * onBefore/onSuccess/onFinish are NOT called, axios request is NOT made.
     * Cache is written only on HTTP 2xx success.
     */
    cache?: string | boolean | CacheOptions;
    /**
     * Invalidate cache entries on HTTP 2xx success.
     * Accepts exact key(s) or `{ prefix }` for bulk invalidation (see {@link InvalidateInput}).
     * Fires only after a confirmed successful response — never in catch/finally.
     * Useful for POST/PUT/DELETE that should bust related GET caches.
     */
    invalidateCache?: InvalidateInput;
    /**
     * Polling configuration.
     * - Pass a **number** (ms) for simple polling.
     * - Pass an **object** `{ interval: number, whenHidden?: boolean }` for advanced control.
     * Properties inside the object can also be Refs.
     */
    poll?: MaybeRefOrGetter<number | { interval: MaybeRefOrGetter<number>; whenHidden?: MaybeRefOrGetter<boolean> }>;
}

/**
 * Per-call override config accepted by `execute()`.
 *
 * A subset of `UseApiOptions` — setup-time-only options are excluded.
 * Any option added to `UseApiOptions` that is not setup-time automatically becomes
 * available here without manual updates.
 *
 * All options **replace** their composable-level counterpart for that call.
 * Lifecycle callbacks (`onSuccess`, `onError`, `onBefore`, `onFinish`) are the exception —
 * they **merge**: composable-level fires first, then per-call.
 *
 * @example
 * ```ts
 * const { execute } = useApi('/users', { onSuccess: () => refreshList() })
 *
 * // Callbacks merge — both refreshList() and toast() fire
 * execute({ onSuccess: () => toast('Saved!') })
 *
 * // Per-call cache invalidation
 * execute({ invalidateCache: ['users-list', 'user-count'] })
 * ```
 */
export type ExecuteConfig<D = unknown> = Omit<
    UseApiOptions<unknown, D, unknown>,
    | "immediate"
    | "initialData"
    | "initialLoading"
    | "debounce"
    | "useGlobalAbort"
    | "lazy"
    | "refetchOnFocus"
    | "refetchOnReconnect"
    | "poll"
    | "select"
>;

export interface UseApiReturn<T = unknown, D = unknown> {
    data: Ref<T | null>;
    loading: Ref<boolean>;
    error: Ref<ApiError | null>;
    statusCode: Ref<number | null>;
    response: Ref<AxiosResponse<unknown> | null>;
    /**
     * `true` while a background revalidation request is in-flight.
     * Only active when `cache: { swr: true }` is set and a cache hit occurred.
     * Use it to show a subtle refresh indicator without blocking the UI.
     */
    revalidating: Ref<boolean>;
    /**
     * The resolved cache key of the last executed request — the auto-derived
     * key (`auto:METHOD:url:...`) or the manual `id`. `null` before the first
     * execute, or when caching is not active for the request.
     * Pass it to `invalidateCache(cacheKey.value)` to bust this exact entry.
     */
    cacheKey: Ref<string | null>;
    execute: (config?: ExecuteConfig<D>) => Promise<T | null>;
    abort: (message?: string) => void;
    reset: () => void;
    /**
     * Run `updater` without triggering auto-tracked re-execution.
     *
     * Pauses the internal tracking scope for the duration of the updater,
     * so reactive changes to `url`, `params`, or `data` inside it do not
     * fire a request.
     *
     * **Synchronous only** — changes after an `await` inside the updater
     * will NOT be suppressed (the scope resumes after the sync portion).
     *
     * Safe to call when `lazy: true` — the updater still runs, no error is thrown.
     *
     * @example
     * ignoreUpdates(() => {
     *   filters.value.status = 'active'
     * })
     * // watch is suppressed — no request fires
     */
    ignoreUpdates: (updater: () => void) => void;
    /**
     * Manually mutate data. Supports direct value or updater function.
     * Clears any existing error when called.
     *
     * @example
     * // Direct value
     * mutate(newUsers)
     *
     * // Updater function (like React's setState)
     * mutate(prev => prev?.filter(u => u.active) ?? null)
     *
     * // Transform data after fetch
     * const { data, mutate } = useApi('/users', {
     *   onSuccess: ({ data }) => {
     *     mutate(data.map(user => ({ ...user, fullName: `${user.first} ${user.last}` })))
     *   }
     * })
     */
    mutate: (newData: T | null | ((prev: T | null) => T | null)) => void;
}

export interface ApiPluginOptions {
    axios: AxiosInstance;
    onError?: (error: ApiError, originalError: unknown) => void;
    /**
     * Custom error parser to transform backend errors into ApiError format.
     * Useful if your backend has a different error structure.
     */
    errorParser?: (error: unknown) => ApiError;
    /** Devtools panel configuration. Panel is disabled by default. */
    devtools?: DevtoolsOptions;
    globalOptions?: {
        retry?: number | boolean;
        retryDelay?: number;
        retryStatusCodes?: number[];
        useGlobalAbort?: boolean;
        /**
         * Apply `refetchOnFocus` to all `useApi` instances.
         * Per-request value (including `false`) takes precedence.
         */
        refetchOnFocus?: boolean | { throttle?: number };
        /**
         * Apply `refetchOnReconnect` to all `useApi` instances.
         * Per-request value (including `false`) takes precedence.
         */
        refetchOnReconnect?: boolean;
        /**
         * Project-wide default fields for the `cache` option (`staleTime`, `swr`,
         * `freshFor`). Applied per-field under a request's own `cache` — e.g. set
         * `{ swr: true, staleTime: "6h", freshFor: "30m" }` once instead of on
         * every composable.
         *
         * **Does NOT enable caching.** A request must still pass `cache`
         * explicitly to be cached — otherwise every request (including mutations)
         * would silently cache. Any `id` here is ignored.
         */
        cacheDefaults?: Partial<CacheOptions>;
        /**
         * Apply `coalesce` to all `useApi` instances.
         * Per-request value (including `false`) takes precedence.
         * When unset, the default is `true`.
         */
        coalesce?: boolean;
    };
}

export interface AuthTokens {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
}

// ============================================================================
// Batch API Types
// ============================================================================

/**
 * Per-request configuration for a single item in a batch operation.
 * String items in the batch array are automatically normalized to this shape
 * with method: 'GET' and no data/params/headers.
 */
export interface BatchRequestConfig<D = unknown> {
    /** The URL to request */
    url: string;
    /** HTTP method. Default: 'GET' */
    method?: string;
    /** Request body (for POST, PUT, PATCH) */
    data?: D;
    /** Query parameters */
    params?: D;
    /** Per-request headers that override global defaults for this request only */
    headers?: Record<string, string>;
}

/**
 * Result of a single request in a batch operation
 */
export interface BatchResultItem<T = unknown> {
    /** The URL that was requested */
    url: string;
    /** Index in the original urls array */
    index: number;
    /**
     * Whether the request succeeded. Equivalent to `status === "success"`.
     * A failed SWR revalidation is a failure here even though `data` still
     * holds the cached value — see `stale`.
     */
    success: boolean;
    /**
     * Lifecycle state of this item. `data` is filled in as soon as the item
     * leaves `pending`, which for an SWR cache hit happens before the network
     * answers. See {@link BatchItemStatus}.
     */
    status: BatchItemStatus;
    /**
     * `true` while `data` comes from the cache and a background revalidation is
     * either in flight or has failed. Flips to `false` once fresh data lands.
     * Always `false` without `cache: { swr: true }`.
     */
    stale: boolean;
    /**
     * The response data. `null` while `pending`, and `null` on a failure that
     * had no cached value to fall back on — a failed revalidation keeps the
     * cached data here with `status: "error"` and `stale: true`, so the UI can
     * show the old value next to the error.
     */
    data: T | null;
    /** Error details (null if succeeded) */
    error: ApiError | null;
    /** HTTP status code */
    statusCode: number | null;
    /** Full AxiosResponse (null if failed — headers, status, etc. accessible here) */
    response: AxiosResponse<T> | null;
    /** The original normalized request config that produced this result */
    request: BatchRequestConfig;
}

/**
 * Progress information for batch operations
 */
export interface BatchProgress {
    /**
     * Number of completed requests (success + failed). An SWR cache hit counts
     * only once its background revalidation settles — it is already visible in
     * `data` before that, with `stale: true`.
     */
    completed: number;
    /** Total number of requests */
    total: number;
    /** Completion percentage (0-100) */
    percentage: number;
    /** Number of successful requests */
    succeeded: number;
    /** Number of failed requests */
    failed: number;
}

/**
 * Cache fields accepted by `useApiBatch` — {@link CacheOptions} without `id`.
 *
 * `id` is excluded because every request in a batch would share one entry, so
 * items 2..N would read the first item's data. Batch caching is always
 * auto-keyed (`method + url + params + data`), giving each request its own entry.
 */
export type BatchCacheOptions = Pick<CacheOptions, "staleTime" | "swr" | "freshFor">;

/**
 * Lifecycle of a single item inside a batch.
 *
 * - `pending` — no result yet: the request is in flight (or queued behind `concurrency`).
 * - `success` — data is available. With `cache: { swr: true }` this is reached
 *   immediately from cache, before the network answers — check `stale`.
 * - `error` — the request failed and no data is available.
 */
export type BatchItemStatus = "pending" | "success" | "error";

/**
 * Options for useApiBatch
 *
 * @typeParam T - Type of each request's data after `select` (defaults to the raw response)
 * @typeParam D - Request body type
 * @typeParam TRaw - Raw response type before `select`
 */
export interface UseApiBatchOptions<T = unknown, D = unknown, TRaw = unknown> extends Omit<ApiRequestConfig<D>, "url"> {
    /**
     * If true (default), failed requests don't stop the batch.
     * If false, first error will reject the entire batch.
     */
    settled?: boolean;
    /** Maximum concurrent requests. Default: unlimited */
    concurrency?: number;
    /** Execute immediately on mount */
    immediate?: boolean;
    /** Skip individual error notifications */
    skipErrorNotification?: boolean;
    /**
     * Disable auto-tracking. When true, reactive changes to the `requests` getter
     * will NOT trigger re-execution. Use when you want full manual control via execute().
     * Default: false — auto-tracks when `requests` is a function.
     */
    lazy?: boolean;
    /**
     * Polling interval in ms, or advanced config object.
     * - Pass a number: `poll: 5000` — re-execute every 5 seconds.
     * - Pass an object: `poll: { interval: 5000, whenHidden: false }` — skip polling when tab is hidden.
     * Properties inside the object can also be Refs.
     */
    poll?: MaybeRefOrGetter<number | {
        interval: MaybeRefOrGetter<number>;
        whenHidden?: MaybeRefOrGetter<boolean>;
    }>;
    /**
     * @deprecated Use a reactive getter for `requests` with `lazy: false` (default).
     * Auto-tracking will re-execute when the getter's dependencies change.
     * Will be removed in v2.0.
     *
     * @example
     * // Before (deprecated):
     * useApiBatch(() => ids.value.map(id => `/items/${id}`), { watch: ids })
     *
     * // After (preferred):
     * useApiBatch(() => ids.value.map(id => `/items/${id}`))
     */
    watch?: WatchSource | WatchSource[];
    /**
     * Cache each request in the batch **independently**, under an auto-derived
     * key (`method + url + params + data`) — so a batch of 3 URLs produces 3
     * cache entries, and a re-run that overlaps a previous batch serves the
     * overlapping items from cache without hitting the network.
     *
     * - `cache: true` — auto-key + defaults (plus any `globalOptions.cacheDefaults`).
     * - `cache: { staleTime: '5m' }` — auto-key with a custom TTL.
     * - `cache: { swr: true }` — cached items are published into `data` immediately
     *   with `stale: true` and refreshed in the background; `revalidating` is `true`
     *   meanwhile. `freshFor` suppresses the background call for young entries.
     *
     * A manual `id` is intentionally not accepted here — see {@link BatchCacheOptions}.
     *
     * @example
     * ```ts
     * const ids = ref([1, 2, 3])
     * const { successfulData } = useApiBatch(
     *   () => ids.value.map(id => `/users/${id}`),
     *   { cache: { staleTime: '5m' } },
     * )
     * // ids -> [2, 3, 4]: only /users/4 hits the network
     * ```
     */
    cache?: boolean | BatchCacheOptions;
    /**
     * Invalidate cache entries after each request in the batch that returns 2xx.
     * Accepts exact key(s) or `{ prefix }` (see {@link InvalidateInput}).
     * Useful for a batch of mutations that should bust related GET caches.
     */
    invalidateCache?: InvalidateInput;
    /**
     * Transform each request's raw response before it lands in the batch result.
     * Applied per item — `data`, `successfulData`, and the `onItem*` callbacks all
     * receive the transformed value.
     *
     * @example
     * ```ts
     * const { successfulData } = useApiBatch<User, { data: User }>(
     *   ['/users/1', '/users/2'],
     *   { select: (res) => res.data },
     * )
     * // successfulData: Ref<User[]>
     * ```
     */
    select?: (data: TRaw) => T;
    /**
     * Re-execute the **whole batch** when the browser tab regains focus
     * (`visibilitychange`).
     *
     * - `true` — default throttle of 60 000ms.
     * - `{ throttle: number }` — custom throttle in ms; `0` always refetches.
     *
     * Skipped while the batch is already running (`loading: true`).
     * Unlike `useApi`, this is **not** inherited from
     * `globalOptions.refetchOnFocus` — a batch re-runs every request it holds,
     * so it opts in explicitly.
     */
    refetchOnFocus?: boolean | { throttle?: number };
    /**
     * Re-execute the whole batch when the browser regains connectivity (`online`).
     * Skipped while the batch is already running. Not inherited from
     * `globalOptions.refetchOnReconnect` — see `refetchOnFocus`.
     */
    refetchOnReconnect?: boolean;
    /**
     * Callback when a single request succeeds — fires once per item, when it
     * reaches its **final** state. An SWR cache hit publishes into `data`
     * immediately but does not fire this until revalidation confirms the data.
     */
    onItemSuccess?: (item: BatchResultItem<T>, index: number) => void;
    /**
     * Callback when a single request fails — fires once per item, when it
     * reaches its final state. A failed SWR revalidation fires this with the
     * item still carrying its cached `data` and `stale: true`.
     */
    onItemError?: (item: BatchResultItem<T>, index: number) => void;
    /** Callback when all requests complete */
    onFinish?: (results: BatchResultItem<T>[]) => void;
    /** Callback when progress updates */
    onProgress?: (progress: BatchProgress) => void;
}

/**
 * Return type for useApiBatch
 */
export interface UseApiBatchReturn<T = unknown> {
    /**
     * All results, in the order of the requests array and always of that length.
     * Filled in **incrementally**: an item is published as soon as it resolves
     * (or immediately, from cache), so the array holds a mix of `pending`,
     * `success` and `error` items while the batch runs.
     */
    data: Ref<BatchResultItem<T>[]>;
    /** Only successful results' data — grows as items land. */
    successfulData: Ref<T[]>;
    /**
     * `true` while at least one item still has no data at all. Items served
     * from cache never set it, so an all-cached batch never flips it —
     * a background SWR refresh shows up in `revalidating` instead.
     */
    loading: Ref<boolean>;
    /**
     * `true` while at least one item is being revalidated in the background
     * after an SWR cache hit. Those items already have data in `data`.
     * Only ever `true` with `cache: { swr: true }`.
     */
    revalidating: Ref<boolean>;
    /** Aggregated error (set if all requests failed) */
    error: Ref<ApiError | null>;
    /** List of all errors from failed requests */
    errors: Ref<ApiError[]>;
    /** Progress tracking */
    progress: Ref<BatchProgress>;
    /** Execute the batch */
    execute: () => Promise<BatchResultItem<T>[]>;
    /** Abort all pending requests */
    abort: (message?: string) => void;
    /** Reset state to initial */
    reset: () => void;
}

// ─── Devtools ────────────────────────────────────────────────────────────────

/** Lifecycle status of an HTTP request tracked by devtools. */
export type RequestStatus = "pending" | "success" | "error" | "aborted";

/** Current reactive state of a useApi instance as seen by devtools. */
export interface DevtoolsInstanceState {
    loading: boolean;
    error: ApiError | null;
    statusCode: number | null;
    data: unknown;
}

/** Configuration options of a useApi instance as seen by devtools. */
/** Resolved cache config as seen by devtools — cacheDefaults already merged in, `id` present only for manual (non-auto) keys. Null/undefined when caching is off. */
export type DevtoolsResolvedCache = { id?: string; staleTime: number; swr: boolean; freshFor: number } | null | undefined;

export interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: DevtoolsResolvedCache;
    retry: boolean | number;
    poll: number;
    immediate: boolean;
    lazy: boolean;
}

/** An outgoing HTTP request record sent to devtools on request start. */
export interface DevtoolsRequestRecord {
    id: string;
    instanceId: string | null;
    url: string;
    method: string;
    startedAt: number;
    status: RequestStatus;
    statusCode: null;
    requestHeaders: Record<string, string>;
    payload: unknown;
    queryParams: unknown;
    /**
     * Resolved cache key for this request (auto-derived or manual id).
     * Null when caching is not active. Optional — standalone records
     * (e.g. token refresh) omit it.
     */
    cacheKey?: string | null;
}

/**
 * Result of a completed HTTP request, sent to devtools on request end.
 * `cachedAt` — Unix ms timestamp of the moment the response was written to
 * the cache; absent when caching was off for the request.
 */
export type RequestEndResult =
    | {
          status: "success";
          statusCode: number;
          response: unknown;
          duration: number;
          cachedAt?: number;
          /**
           * Final request headers as sent on the wire (post-interceptor),
           * sensitive values redacted. Optional — older emitters omit it.
           */
          requestHeaders?: Record<string, string>;
          /** Response headers, sensitive values redacted. Optional — older emitters omit it. */
          responseHeaders?: Record<string, string>;
      }
    | {
          status: "error";
          error: ApiError;
          statusCode: number | null;
          duration: number;
          /**
           * Final request headers as sent on the wire (post-interceptor),
           * sensitive values redacted. Optional — older emitters omit it.
           */
          requestHeaders?: Record<string, string>;
          /** Response headers, sensitive values redacted. Optional — older emitters omit it. */
          responseHeaders?: Record<string, string>;
      }
    | { status: "aborted"; duration: number };

/** Event callbacks implemented by the devtools panel, called by useApi instrumentation. */
export interface DevtoolsBridge {
    /** Fired when a useApi instance is created. */
    onInstanceCreated: (id: string, url: string | undefined, options: DevtoolsInstanceOptions) => void;
    /** Fired when a useApi instance is destroyed (scope disposed). */
    onInstanceDestroyed: (id: string) => void;
    /** Fired when instance state (loading, error, statusCode, data) changes. */
    onStateUpdate: (id: string, state: Partial<DevtoolsInstanceState>) => void;
    /** Fired when an HTTP request starts. */
    onRequestStart: (record: DevtoolsRequestRecord) => void;
    /** Fired when an HTTP request completes (success, error, or abort). */
    onRequestEnd: (id: string, result: RequestEndResult) => void;
    /**
     * Fired when a request hit a 401 and is transparently retried after a
     * successful token refresh. OPTIONAL — older `@ametie/vue-muza-devtools`
     * versions do not implement it; callers must guard with `?.`.
     * (Intentional divergence from the devtools-side mirror, where it is required.)
     */
    onRequestAuthRetry?: (id: string) => void;
}

/**
 * Options for the `@ametie/vue-muza-devtools` panel.
 *
 * @example
 * ```ts
 * app.use(createApi({
 *   axios: apiClient,
 *   devtools: { enabled: process.env.NODE_ENV !== 'production' },
 * }))
 * ```
 */
export interface DevtoolsOptions {
    /** Enable the devtools panel. Default: false. */
    enabled: boolean;
    /** Maximum number of network requests kept in history. Default: 300. */
    maxHistory?: number;
    /** Maximum payload/response size in bytes before truncation. Default: 200_000. */
    maxPayloadSize?: number;
    /** Custom tabs appended after built-in tabs. */
    tabs?: Array<{ id: string; label: string; component: unknown; icon?: unknown; order?: number }>;
}
