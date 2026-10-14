import type { AxiosRequestConfig, AxiosResponse, AxiosInstance } from "axios";
import type {MaybeRefOrGetter, Ref} from "vue";
import type { TokenManager } from "./features/tokenManager";

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
    /**
     * Named client (registered with `createApi({ clients })`) the request goes
     * through. Default: the main `axios`. Fixed for the composable — not
     * reactive and not overridable per `execute()`. An unknown name throws when
     * the composable is created. Auto cache keys are scoped by client
     * (`auto@tools:GET:/brands:...`); the default client's keys are unchanged.
     */
    client?: ApiClientName;
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
    | "client"
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
    /**
     * Reset `data`, `error` and `loading` back to their initial values.
     *
     * Safe to call while a request is in flight (e.g. from `onUnmounted`): the
     * request is aborted, its `execute()` promise resolves with `null`, and the
     * cancelled request writes nothing back into the state afterwards.
     */
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

// ============================================================================
// Named Clients
// ============================================================================

/**
 * Registry of named API clients, empty by default. Augment it to type-check the
 * `client` option — without augmentation any string is accepted.
 *
 * @example
 * ```ts
 * declare module "@ametie/vue-muza-use" {
 *     interface ApiClientRegistry {
 *         tools: true;
 *     }
 * }
 * useApiGet("/brands", { client: "tools" }); // ✅
 * useApiGet("/brands", { client: "tool" });  // ❌ type error
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface ApiClientRegistry {}

/**
 * A client name accepted by the `client` option: `"default"` or a name declared in
 * {@link ApiClientRegistry}; any string while the registry is not augmented.
 */
export type ApiClientName = [keyof ApiClientRegistry] extends [never]
    ? string
    : "default" | Extract<keyof ApiClientRegistry, string>;

/**
 * Full form of a named client registered through `createApi({ clients })`.
 */
export interface ApiClientConfig {
    /** The axios instance requests for this client go through. */
    axios: AxiosInstance;
    /** Error parser for this client's failures. Default: the global `errorParser`, then the built-in one. */
    errorParser?: (error: unknown) => ApiError;
}

/**
 * Third argument of the global `onError` — passed for named-client failures only.
 * Default-client failures call `onError(error, originalError)` exactly as before 1.9.
 */
export interface ApiErrorContext {
    /** Name of the client the failed request used. */
    client: string;
}

export interface ApiPluginOptions {
    axios: AxiosInstance;
    /**
     * Global error handler. For a request sent through a named client the third
     * argument names that client; default-client requests pass two arguments.
     */
    onError?: (error: ApiError, originalError: unknown, context?: ApiErrorContext) => void;
    /**
     * Extra axios instances, addressable per request with the `client` option.
     * Each value is an axios instance or `{ axios, errorParser? }`. The name
     * `default` is reserved for `axios` above. New in 1.9.
     *
     * @example
     * ```ts
     * createApi({
     *     axios: insightsApi,
     *     clients: { tools: toolsApi, mcp: { axios: mcpApi, errorParser: parseMcpError } },
     * })
     * ```
     */
    clients?: Record<string, AxiosInstance | ApiClientConfig>;
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
// Token Storage Types
// ============================================================================

/**
 * Where a `TokenManager` keeps its tokens. The library ships
 * `LocalStorageTokenStorage`; implement this interface for any other place
 * (for example in memory, for a token that must not persist).
 *
 * @example
 * ```ts
 * let current: AuthTokens | null = null;
 * const memoryStorage: TokenStorage = {
 *     getAccessToken: () => current?.accessToken ?? null,
 *     getRefreshToken: () => current?.refreshToken ?? null,
 *     setTokens: (tokens) => { current = tokens; },
 *     clearTokens: () => { current = null; },
 *     getTokenExpiresAt: () => null,
 *     isTokenExpired: () => false,
 * };
 * const store = new TokenManager(memoryStorage);
 * ```
 */
export interface TokenStorage {
    /** Current access token, or `null` when none is stored. */
    getAccessToken(): string | null;
    /** Current refresh token, or `null` when none is stored (or it lives in an httpOnly cookie). */
    getRefreshToken(): string | null;
    /** Store a token set. `expiresIn` is in seconds from now. */
    setTokens(tokens: AuthTokens): void;
    /** Remove every token this storage holds. */
    clearTokens(): void;
    /** Expiry of the access token in ms since epoch, or `null` when unknown. */
    getTokenExpiresAt(): number | null;
    /** `true` when the access token is known to be expired. */
    isTokenExpired(): boolean;
}

/**
 * localStorage key names used by one `LocalStorageTokenStorage`. All three are
 * required and must be three different, non-empty strings — a partial set would
 * silently share the remaining default keys with the main `tokenManager`.
 */
export interface TokenStorageKeys {
    /** Key of the access token. Default store: `"accessToken"`. */
    accessToken: string;
    /**
     * Key of the refresh token. Default store: `"refreshToken"`. Never read or
     * written when `storeRefreshToken` is `false`, but must still be distinct.
     */
    refreshToken: string;
    /** Key of the expiry timestamp (ms since epoch). Default store: `"tokenExpiresAt"`. */
    expiresAt: string;
}

/** Options of the `LocalStorageTokenStorage` constructor. */
export interface LocalStorageTokenStorageOptions {
    /** Keep the refresh token in localStorage. `false`: it lives in an httpOnly cookie. Default: `true`. */
    storeRefreshToken?: boolean;
    /** Custom key names. Default: `accessToken` / `refreshToken` / `tokenExpiresAt`. */
    keys?: TokenStorageKeys;
}

// ============================================================================
// Auth Session Types
// ============================================================================

/**
 * What a function refresh transport receives from the session.
 */
export interface RefreshContext {
    /** Refresh token from the token store, or `null` (cookie-based refresh). */
    refreshToken: string | null;
    /** The access token the failed request was sent with, or the token at `refresh()` call time. */
    staleAccessToken: string | null;
}

/**
 * What a function refresh transport must resolve with. Stored in the session's
 * token store as-is (`expiresIn` in seconds, like {@link AuthTokens}).
 */
export interface RefreshResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
}

/**
 * Declarative refresh transport — the same request the legacy
 * `createApiClient({ authOptions })` interceptor sends, but through a private,
 * interceptor-free axios instance that can point at any backend.
 *
 * @example
 * ```ts
 * createAuthSession({
 *     refresh: { url: "/auth/refresh", baseURL: "https://insights.example", withCredentials: true },
 * })
 * ```
 */
export interface DeclarativeRefreshOptions {
    /** Refresh endpoint, e.g. `"/auth/refresh"`. Sent as a POST. */
    url: string;
    /** Base URL of the backend that issues tokens, e.g. `"/api"` or `"https://insights.example"`. */
    baseURL?: string;
    /**
     * Send cookies with the refresh request. Same meaning as
     * `authOptions.refreshWithCredentials`: when no refresh token is stored,
     * credentials are sent anyway.
     */
    withCredentials?: boolean;
    /** Request body — a static object or a (possibly async) function returning one. */
    payload?: Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>);
    /**
     * Read tokens from a non-standard response. Default: `accessToken || access_token`
     * and `refreshToken || refresh_token` from the response body.
     */
    extractTokens?: (response: AxiosResponse) => { accessToken: string; refreshToken?: string };
    /**
     * Awaited after the new tokens are stored and **before** waiting requests are
     * released — same semantics as `authOptions.onTokenRefreshed`. Throwing fails the refresh.
     */
    onTokenRefreshed?: (response: AxiosResponse) => void | Promise<void>;
    /** Refresh request timeout in ms. Default: 60000. */
    timeout?: number;
}

/**
 * Options for {@link createAuthSession}.
 */
export interface AuthSessionOptions {
    /**
     * How to obtain new tokens: a {@link DeclarativeRefreshOptions} object, or a
     * function that performs the refresh and resolves with a {@link RefreshResult}.
     *
     * **Function contract:** if the function sends its request through an axios
     * instance attached to this session, it must pass `authMode: "public"` —
     * otherwise a 401 from the refresh endpoint waits on the refresh that sent it.
     */
    refresh: DeclarativeRefreshOptions | ((context: RefreshContext) => Promise<RefreshResult>);
    /** Token store. Default: the exported `tokenManager` singleton. */
    tokens?: TokenManager;
    /**
     * When set, the session configures its token store once at creation:
     * `true` keeps both tokens in localStorage, `false` keeps only the access
     * token (refresh token in an httpOnly cookie). When omitted, the store is
     * left exactly as it is.
     */
    storeRefreshToken?: boolean;
    /**
     * Coordinate refreshes between tabs of the same origin through the Web Locks
     * API (`lockName` default: `"vue-muza-use:auth-refresh"`). A tab that gets the
     * lock after another tab already replaced the token adopts that token instead
     * of refreshing again. Ignored when `navigator.locks` is unavailable.
     *
     * **Requires a token store shared between tabs** — the default `tokenManager`
     * (localStorage). With a per-tab store (in-memory or a custom `TokenStorage`)
     * refreshes are only serialised and every tab still refreshes on its own; with
     * a one-time-use refresh token the later tab's refresh fails and ends its session.
     *
     * Default: `false`.
     */
    crossTab?: boolean | { lockName?: string };
    /**
     * `fetch` implementation behind `session.fetch`. Default: `globalThis.fetch`,
     * looked up on every call (so a later polyfill or test stub is picked up).
     */
    fetch?: typeof fetch;
}

/**
 * Payload of each {@link AuthSession} event.
 */
export interface AuthSessionEventMap {
    /** A refresh is starting. */
    refreshStart: { staleAccessToken: string | null };
    /**
     * New access token is stored. `response` is the raw refresh response for the
     * declarative transport, `null` for a function transport or an adopted token.
     */
    refreshed: { accessToken: string; response: AxiosResponse | null };
    /** The refresh failed; tokens have already been cleared. */
    refreshFailed: { error: unknown };
    /** `session.clear()` was called; tokens have already been cleared. */
    cleared: Record<string, never>;
}

/** Name of an {@link AuthSession} event. */
export type AuthSessionEvent = keyof AuthSessionEventMap;

/**
 * A shared authentication session: one owner of the access token and of the
 * token refresh, for any number of axios instances and non-axios consumers.
 * Created with {@link createAuthSession}.
 */
export interface AuthSession {
    /** Current access token from the token store, or `null`. */
    getAccessToken(): string | null;
    /** `"Bearer <token>"`, or `null` when no token is stored. */
    getAuthHeader(): string | null;
    /**
     * Refresh the access token and resolve with the new one. Single-flight: while
     * a refresh is in flight every call awaits that same refresh. On failure the
     * tokens are cleared, `refreshFailed` is emitted once, and every caller rejects.
     *
     * `staleAccessToken` — the token the failed request was sent with (default:
     * the token stored at call time); used by `crossTab` adoption.
     */
    refresh(options?: { staleAccessToken?: string | null }): Promise<string>;
    /** `true` while a refresh is in flight. */
    readonly isRefreshing: boolean;
    /**
     * Subscribe to a session event. Listeners run synchronously after the token
     * store has been updated; a throwing listener is logged and never breaks the
     * refresh. Returns an unsubscribe function.
     */
    on<E extends AuthSessionEvent>(event: E, listener: (payload: AuthSessionEventMap[E]) => void): () => void;
    /** Clear the tokens (e.g. on logout) and emit `cleared`. Does not abort an in-flight refresh. */
    clear(): void;
    /**
     * Drop-in `fetch` that sends the session's token and, on a 401, refreshes
     * through the session and repeats the request once. Never throws for an HTTP
     * status: if the refresh fails, the original 401 response is returned.
     *
     * - A request that already carries an `Authorization` header is passed through untouched.
     * - The repeat needs a replayable body (string, `URLSearchParams`, `FormData`,
     *   `Blob`, `ArrayBuffer`/view, none, or a `Request`); with a `ReadableStream`
     *   body the session still refreshes but returns the original 401.
     * - Bound — pass it as-is, e.g. `new HttpLink({ uri, fetch: session.fetch })`.
     */
    fetch: typeof fetch;
    /**
     * Advanced — install the session's request/response interceptors on an axios
     * instance: the current token is sent with every non-public request, and a 401
     * refreshes through this session and retries the request once. Every attached
     * instance shares the session's single refresh. `createApiClient({ authSession })`
     * calls this for you; use it directly only for an instance you create yourself.
     */
    attach(instance: AxiosInstance): void;
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
    /** Named client for this request — overrides the batch-level `client`. */
    client?: ApiClientName;
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
     * `data` before that, with `stale: true`. Cancelled requests
     * (`status: "aborted"`) are neither, so an aborted batch stops short of
     * `total` instead of reporting the cancellations as failures.
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
 * - `aborted` — the request was cancelled before it could answer, by `abort()`,
 *   `reset()`, a replacing `execute()` or scope disposal. Not a failure: it never
 *   reaches `errors`, never fires `onItemError` and never counts towards the
 *   aggregated `BATCH_ALL_FAILED` error. A cancelled SWR revalidation keeps the
 *   cached value in `data` with `stale: true`.
 */
export type BatchItemStatus = "pending" | "success" | "error" | "aborted";

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
    /**
     * Named client for every request in the batch (see `UseApiOptions.client`).
     * A request item's own `client` takes precedence.
     */
    client?: ApiClientName;
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
     * `success`, `error` and `aborted` items while the batch runs.
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
    /**
     * Aggregated error — set when every request that got an answer failed.
     * Cancelled items (`status: "aborted"`) are not counted, so aborting or
     * resetting a batch mid-flight never produces `BATCH_ALL_FAILED`.
     */
    error: Ref<ApiError | null>;
    /** List of all errors from failed requests */
    errors: Ref<ApiError[]>;
    /** Progress tracking */
    progress: Ref<BatchProgress>;
    /**
     * Execute the batch.
     *
     * Calling it again cancels the run in flight. The cancelled run's promise
     * still resolves — with its own snapshot, where everything that never
     * answered is `status: "aborted"` — and from the moment it is replaced it
     * writes nothing more to `data`, `errors`, `progress` or `loading`, and its
     * `onFinish` / `onItemSuccess` / `onItemError` no longer fire.
     */
    execute: () => Promise<BatchResultItem<T>[]>;
    /**
     * Abort all pending requests. Everything that never answered ends up as
     * `status: "aborted"` — not counted as a failure, so `error` stays `null`
     * and `onItemError` does not fire. The run is cancelled, not discarded: it
     * still clears `loading` and calls `onFinish` with its final snapshot once
     * the requests unwind. Use `reset()` to drop the run entirely.
     */
    abort: (message?: string) => void;
    /**
     * Reset state to initial — `data`, `errors` and `error` are cleared and
     * progress goes back to zero.
     *
     * Safe to call while requests are in flight (e.g. from `onUnmounted`): the
     * current run is aborted, its `execute()` promise resolves with a snapshot of
     * the results as of the cancellation, and after that it can no longer write to
     * `data` / `errors` / `progress`, nor fire `onFinish`, `onItemSuccess` or
     * `onItemError`.
     */
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
