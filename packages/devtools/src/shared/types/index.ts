import type { Component } from "vue";

// Layout types

/**
 * Layout mode for the devtools panel.
 * - `bottom`: docked to the bottom of the viewport
 * - `side`: docked to the right side of the viewport
 */
export type PanelMode = "bottom" | "side";

/**
 * Position and size of a devtools panel in a given mode.
 */
export interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Display format for the payload viewer pane.
 * - `kv`: collapsible key-value tree view
 * - `json`: raw JSON syntax-highlighted view
 */
export type PayloadFormat = "kv" | "json";

// Request domain types

/**
 * The lifecycle status of an HTTP request being tracked by devtools.
 *
 * - `pending`: request in flight
 * - `success`: completed with 2xx status
 * - `error`: completed with error or non-2xx status
 * - `aborted`: cancelled before completion
 */
export type RequestStatus = "pending" | "success" | "error" | "aborted";

/**
 * Normalized error shape from an HTTP response.
 */
export interface ApiError {
    message: string;
    status: number;
    code?: string;
    /** Full response body from the server when the request failed. */
    details?: unknown;
}

/**
 * A recorded HTTP request as seen by devtools.
 *
 * Payload and response may be truncated if they exceed `maxPayloadSize`.
 *
 * @property id Unique identifier for this request record
 * @property instanceId ID of the useApi composable that initiated this; null for standalone requests
 * @property url The request endpoint
 * @property method HTTP method (GET, POST, etc.)
 * @property startedAt Unix timestamp in milliseconds when the request began
 * @property duration Elapsed time in milliseconds; null while pending
 * @property status Current lifecycle status
 * @property statusCode HTTP response status; null while pending or if no response received
 * @property requestHeaders Request headers sent
 * @property payload Request body only; may be truncated
 * @property queryParams Query params; may be truncated
 * @property response Response body; may be truncated
 * @property error Populated on error status
 * @property truncated True if payload, queryParams, or response was truncated due to size limit
 */
export interface RequestRecord {
    id: string;
    instanceId: string | null;
    url: string;
    method: string;
    startedAt: number;
    duration: number | null;
    status: RequestStatus;
    statusCode: number | null;
    requestHeaders: Record<string, string>;
    payload: unknown;
    queryParams: unknown;
    response: unknown;
    error: ApiError | null;
    truncated: boolean;
    /** Snapshot of the instance's feature options taken at request creation time. Populated if the instance was registered; undefined for batch or untracked requests. */
    instanceOptions: DevtoolsInstanceOptions | undefined;
    /** Resolved cache key for this request; null when caching inactive; undefined for standalone records. Mirrors use-api. */
    cacheKey?: string | null;
    /** Unix ms timestamp when the response was written to the cache; absent/undefined if caching was off. Mirrors use-api. */
    cachedAt?: number;
    /** True when this request hit a 401 and was transparently retried after a token refresh. Set via the onRequestAuthRetry bridge event. */
    authRetried?: boolean;
    /** Response headers captured at completion; sensitive values redacted upstream. Mirrors use-api. */
    responseHeaders?: Record<string, string>;
}

/**
 * The shape accepted when a request STARTS. Duration, response, error, truncated,
 * instanceOptions, cachedAt, authRetried, and responseHeaders are added on
 * completion — never at start.
 */
export type RequestStartRecord = Omit<
    RequestRecord,
    "duration" | "response" | "error" | "truncated" | "instanceOptions" | "cachedAt" | "authRetried" | "responseHeaders"
>;

/**
 * Result of a completed HTTP request.
 *
 * Discriminated union on `status` — only relevant fields are present per branch.
 * Mirrors RequestEndResult in @ametie/vue-muza-use — keep in sync.
 */
export type RequestEndResult =
    | {
          status: "success";
          statusCode: number;
          response: unknown;
          duration: number;
          cachedAt?: number;
          /** Final request headers (post-interceptor), sensitive values redacted. Optional — older use-api versions omit it. */
          requestHeaders?: Record<string, string>;
          /** Response headers, sensitive values redacted. Optional — older use-api versions omit it. */
          responseHeaders?: Record<string, string>;
      }
    | {
          status: "error";
          error: ApiError;
          statusCode: number | null;
          duration: number;
          /** Final request headers (post-interceptor), sensitive values redacted. Optional — older use-api versions omit it. */
          requestHeaders?: Record<string, string>;
          /** Response headers, sensitive values redacted. Optional — older use-api versions omit it. */
          responseHeaders?: Record<string, string>;
      }
    | { status: "aborted"; duration: number };

// Instance domain types

/**
 * Authentication mode for an API request.
 *
 * - `default`: standard auth with JWT token
 * - `public`: no auth header sent
 * - `optional`: auth sent if token exists, but not required
 */
export type AuthMode = "default" | "public" | "optional";

/**
 * Human-readable duration string, e.g. "500ms", "30s", "5m", "1.5h", "1d".
 * Mirrors DurationString in @ametie/vue-muza-use — keep in sync.
 */
export type DurationString = `${number}ms` | `${number}s` | `${number}m` | `${number}h` | `${number}d`;

/** A duration in milliseconds or a DurationString. */
export type DurationInput = number | DurationString;

/**
 * Cache configuration for a request.
 * Mirrors CacheOptions in @ametie/vue-muza-use — keep in sync.
 *
 * @property id Cache key. Optional — omit to auto-derive from method+url+params+data
 * @property staleTime How long cached data lives (ms or duration string); default 300_000
 * @property swr Serve stale data instantly while revalidating in background
 * @property freshFor Age below which an SWR hit skips background revalidation; default 0
 */
export interface CacheOptions {
    id?: string;
    staleTime?: DurationInput;
    swr?: boolean;
    freshFor?: DurationInput;
}

/**
 * The current reactive state of a useApi composable instance.
 *
 * @property loading True while a request is in flight
 * @property error Populated if the last request failed
 * @property statusCode HTTP status of the last response; null if never completed
 * @property data The most recent response data
 */
export interface DevtoolsInstanceState {
    loading: boolean;
    error: ApiError | null;
    statusCode: number | null;
    data: unknown;
}

/**
 * Resolved cache config as seen by devtools — cacheDefaults already merged in.
 * `id` is present only for a manual (non-auto) key. `null`/`undefined` when caching is off.
 * Mirrors DevtoolsResolvedCache in @ametie/vue-muza-use — keep in sync.
 */
export type DevtoolsResolvedCache = { id?: string; staleTime: number; swr: boolean; freshFor: number } | null | undefined;

/**
 * Configuration options applied to a useApi composable instance.
 *
 * @property authMode Which auth strategy is used
 * @property cache Resolved cache config (cacheDefaults merged in), or null if caching disabled
 * @property retry Retry on 5xx; true/false or max retry count
 * @property poll Polling interval in milliseconds; 0 = disabled
 * @property immediate Execute request immediately on composable creation
 * @property lazy Defer request until manually triggered
 */
export interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: DevtoolsResolvedCache;
    retry: boolean | number;
    poll: number;
    immediate: boolean;
    lazy: boolean;
    /** Debounce delay in milliseconds; undefined if debouncing is not configured. */
    debounce?: number;
    /** True if this instance belongs to a useApiBatch call. */
    batch?: boolean;
}

/**
 * Snapshot of a useApi composable instance as tracked by devtools.
 *
 * @property id Unique instance ID
 * @property url The endpoint URL; undefined before first request if using a getter
 * @property method HTTP method used
 * @property createdAt Unix timestamp (ms) when the composable was created
 * @property state Current reactive state (loading, data, error, etc.)
 * @property options Configuration options applied to this instance
 * @property requestCount Total number of requests issued by this instance
 * @property lastRequestAt Unix timestamp (ms) of the most recent request; null if none issued
 */
export interface DevtoolsInstance {
    id: string;
    url: string | undefined;
    method: string;
    createdAt: number;
    state: DevtoolsInstanceState;
    options: DevtoolsInstanceOptions;
    requestCount: number;
    lastRequestAt: number | null;
}

// Bridge: callbacks from useApi instrumentation to devtools panel

/**
 * Event callbacks for devtools to observe useApi lifecycle and request activity.
 *
 * Implemented by the devtools panel; called by instrumentation hooks in `useApi.ts`.
 *
 * @example
 * ```ts
 * const bridge: DevtoolsBridge = {
 *   onInstanceCreated: (id, url, options) => store.registerInstance(id, url, options),
 *   onInstanceDestroyed: (id) => store.unregisterInstance(id),
 *   onStateUpdate: (id, state) => store.updateInstanceState(id, state),
 *   onRequestStart: (record) => store.addRequest(record),
 *   onRequestEnd: (id, result) => store.updateRequest(id, result),
 * };
 * ```
 */
export interface DevtoolsBridge {
    /** Called when a useApi composable is created. */
    onInstanceCreated: (id: string, url: string | undefined, options: DevtoolsInstanceOptions) => void;
    /** Called when a useApi composable is destroyed (component unmounted). */
    onInstanceDestroyed: (id: string) => void;
    /** Called when a useApi instance's reactive state changes. */
    onStateUpdate: (id: string, state: Partial<DevtoolsInstanceState>) => void;
    /** Called when a request begins. Duration, response, error, truncated, instanceOptions, and cachedAt are added on completion or derived internally. */
    onRequestStart: (record: RequestStartRecord) => void;
    /** Called when a request completes (success, error, or abort). */
    onRequestEnd: (id: string, result: RequestEndResult) => void;
    /**
     * Called when a request hit a 401 and is transparently retried after a
     * successful token refresh. Required here — this package always implements
     * it. The use-api mirror declares it optional for backward compatibility
     * with older devtools versions (intentional divergence).
     */
    onRequestAuthRetry: (id: string) => void;
}

// Plugin configuration

/**
 * A custom tab registered in the devtools panel.
 *
 * @property id Unique tab identifier
 * @property label Display name in the tab bar
 * @property component Vue component rendered when this tab is active
 * @property icon Optional icon (Iconify string name or Vue component)
 * @property order Tab sort order; lower values appear first (default: insertion order)
 */
export interface DevtoolsTab {
    id: string;
    label: string;
    component: Component;
    icon?: string | Component;
    order?: number;
}

/**
 * Configuration options for `createApi({ devtools: ... })`.
 *
 * @property enabled Enable devtools panel
 * @property maxHistory Max request records kept in memory; default 300
 * @property maxPayloadSize Max bytes per payload/response before truncation; default 200_000
 * @property tabs Additional custom tabs to register in the panel
 */
export interface DevtoolsOptions {
    enabled: boolean;
    maxHistory?: number;
    maxPayloadSize?: number;
    tabs?: DevtoolsTab[];
}
