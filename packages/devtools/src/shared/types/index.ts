import type { Component } from "vue";

// Layout types

/**
 * Layout mode for the devtools panel.
 * - `bottom`: docked to the bottom of the viewport
 * - `side`: docked to the right side of the viewport
 */
export type PanelMode = "bottom" | "side";

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
}

/**
 * Result of a completed HTTP request.
 *
 * Discriminated union on `status` — only relevant fields are present per branch.
 */
export type RequestEndResult =
    | { status: "success"; statusCode: number; response: unknown; duration: number }
    | { status: "error"; error: ApiError; statusCode: number | null; duration: number }
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
 * Cache configuration for a request.
 *
 * @property id Unique cache key
 * @property staleTime How long (ms) cached data is considered fresh; default 300_000
 * @property swr Serve stale data instantly while revalidating in background
 */
export interface CacheOptions {
    id: string;
    staleTime?: number;
    swr?: boolean;
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
 * Configuration options applied to a useApi composable instance.
 *
 * @property authMode Which auth strategy is used
 * @property cache Cache options, cache ID string, or undefined if caching disabled
 * @property retry Retry on 5xx; true/false or max retry count
 * @property poll Polling interval in milliseconds; 0 = disabled
 * @property immediate Execute request immediately on composable creation
 * @property lazy Defer request until manually triggered
 */
export interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: CacheOptions | string | undefined;
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
    /** Called when a request begins. Duration, response, error, and truncated are added on completion. */
    onRequestStart: (record: Omit<RequestRecord, "duration" | "response" | "error" | "truncated">) => void;
    /** Called when a request completes (success, error, or abort). */
    onRequestEnd: (id: string, result: RequestEndResult) => void;
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
 * @property maxHistory Max request records kept in memory; default 100
 * @property maxPayloadSize Max bytes per payload/response before truncation; default 50_000
 * @property tabs Additional custom tabs to register in the panel
 */
export interface DevtoolsOptions {
    enabled: boolean;
    maxHistory?: number;
    maxPayloadSize?: number;
    tabs?: DevtoolsTab[];
}
