import type { Component } from "vue";

// ─── Request ────────────────────────────────────────────────────────────────

export type RequestStatus = "pending" | "success" | "error" | "aborted";

export interface ApiError {
    message: string;
    status: number;
    code?: string;
}

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
    response: unknown;
    error: ApiError | null;
    truncated: boolean;
}

export type RequestEndResult =
    | { status: "success"; statusCode: number; response: unknown; duration: number }
    | { status: "error"; error: ApiError; statusCode: number | null; duration: number }
    | { status: "aborted"; duration: number };

// ─── Instance ────────────────────────────────────────────────────────────────

export type AuthMode = "default" | "public" | "optional";

export interface CacheOptions {
    id: string;
    staleTime?: number;
    swr?: boolean;
}

export interface DevtoolsInstanceState {
    loading: boolean;
    error: ApiError | null;
    statusCode: number | null;
    data: unknown;
}

export interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: CacheOptions | string | undefined;
    retry: boolean | number;
    poll: number;
    immediate: boolean;
    lazy: boolean;
}

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

// ─── Bridge ──────────────────────────────────────────────────────────────────

export interface DevtoolsBridge {
    onInstanceCreated: (id: string, url: string | undefined, options: DevtoolsInstanceOptions) => void;
    onInstanceDestroyed: (id: string) => void;
    onStateUpdate: (id: string, state: Partial<DevtoolsInstanceState>) => void;
    onRequestStart: (record: Omit<RequestRecord, "duration" | "response" | "error" | "truncated">) => void;
    onRequestEnd: (id: string, result: RequestEndResult) => void;
}

// ─── Config & Plugin ─────────────────────────────────────────────────────────

export interface DevtoolsTab {
    id: string;
    label: string;
    component: Component;
    icon?: string | Component;
    order?: number;
}

export interface DevtoolsOptions {
    enabled: boolean;
    maxHistory?: number;
    maxPayloadSize?: number;
    tabs?: DevtoolsTab[];
}
