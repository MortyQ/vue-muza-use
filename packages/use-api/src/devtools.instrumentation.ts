/**
 * Devtools instrumentation — the adapter between `useApi`'s request pipeline and the
 * bridge proxy in `./devtools`. Lives in its own module so the pipeline is not
 * interleaved with record-building, and so the bridge stays independently mockable.
 */

import { getCurrentScope, toValue, watch, type Ref } from "vue";
import { isAxiosError, type AxiosResponse } from "axios";

import type { ApiError, CacheOptions, DevtoolsRequestRecord, RequestEndResult, UseApiOptions } from "./types";
import { devtoolsBridge, isDevtoolsExpected, nextRequestId } from "./devtools";
import { normalizeCacheOptions } from "./features/cacheManager";
import { normalizeHeaders } from "./utils/headerUtils";

/** The subset of `UseApiOptions` shown in the devtools instance list. */
type InstrumentedOptions = Pick<UseApiOptions, "authMode" | "cache" | "retry" | "poll" | "immediate" | "lazy">;

/** The reactive state devtools mirrors for an instance. */
interface InstrumentedState<T> {
    data: Ref<T | null>;
    loading: Ref<boolean>;
    error: Ref<ApiError | null>;
    statusCode: Ref<number | null>;
}

/**
 * Register a `useApi` instance with devtools and mirror its reactive state.
 *
 * The reported `cache` is the *resolved* snapshot (cacheDefaults merged in), not the
 * raw `options.cache` — otherwise `cache: true` would show as a bare, meaningless
 * value and swr/freshFor inherited from cacheDefaults would be invisible.
 *
 * The state watcher is installed only when devtools is expected and a scope exists,
 * so instrumentation costs nothing when devtools is off.
 */
export function instrumentInstance<T>(
    instanceId: string,
    url: string | undefined,
    options: InstrumentedOptions,
    cacheDefaults: Partial<CacheOptions> | undefined,
    state: InstrumentedState<T>,
): void {
    const poll = toValue(options.poll);
    devtoolsBridge.onInstanceCreated(instanceId, url, {
        authMode: options.authMode ?? "default",
        cache: normalizeCacheOptions(options.cache, undefined, cacheDefaults),
        retry: options.retry ?? false,
        poll: typeof poll === "number" ? poll : 0,
        immediate: options.immediate ?? false,
        lazy: options.lazy ?? false,
    });

    if (!getCurrentScope() || !isDevtoolsExpected()) return;
    watch(
        () => ({
            loading: state.loading.value,
            error: state.error.value,
            statusCode: state.statusCode.value,
            data: state.data.value,
        }),
        (snapshot) => devtoolsBridge.onStateUpdate(instanceId, snapshot),
        { deep: true },
    );
}

/**
 * Per-request devtools recorder. Owns the request id, the start timestamp and the
 * pending end-result so the request pipeline in `useApi` does not have to carry
 * three mutable locals and rebuild the record shape in four places.
 *
 * `end()` is safe to call unconditionally in a `finally`: it no-ops when `start()`
 * was never reached (e.g. a missing URL threw first), and reports `"aborted"` when
 * no outcome was recorded.
 */
export interface RequestTrace {
    /** Record the outgoing request. Returns the generated request id. */
    start(record: Omit<DevtoolsRequestRecord, "id" | "instanceId" | "startedAt" | "status" | "statusCode" | "requestHeaders">): string;
    /** Record a 2xx outcome. `cachedAt` is set only when the response was cached. */
    success(response: AxiosResponse, cachedAt?: number): void;
    /** Record a failed request (post-flight — headers are read off the axios error). */
    failure(apiError: ApiError, err: unknown): void;
    /** Record a failure raised before the request went out — no status, no headers. */
    setupFailure(apiError: ApiError): void;
    /** Flush the outcome to devtools. No-op when `start()` never ran. */
    end(): void;
}

/**
 * Create a {@link RequestTrace} for one execution of a request.
 */
export function createRequestTrace(instanceId: string): RequestTrace {
    let id: string | null = null;
    let startedAt = 0;
    let result: RequestEndResult | null = null;
    const elapsed = () => Date.now() - startedAt;

    return {
        start(record): string {
            id = nextRequestId();
            startedAt = Date.now();
            devtoolsBridge.onRequestStart({
                ...record,
                id,
                instanceId,
                startedAt,
                status: "pending",
                statusCode: null,
                requestHeaders: {},
            });
            return id;
        },
        success(response, cachedAt): void {
            result = {
                status: "success",
                statusCode: response.status,
                response: response.data,
                duration: elapsed(),
                ...(cachedAt !== undefined ? { cachedAt } : {}),
                // Headers exist only post-flight (interceptors mutate config.headers),
                // so they're captured at end — not in start()
                ...(isDevtoolsExpected()
                    ? {
                          requestHeaders: normalizeHeaders(response.config?.headers),
                          responseHeaders: normalizeHeaders(response.headers),
                      }
                    : {}),
            };
        },
        failure(apiError, err): void {
            result = {
                status: "error",
                error: apiError,
                statusCode: apiError.status ?? null,
                duration: elapsed(),
                ...(isDevtoolsExpected() && isAxiosError(err)
                    ? {
                          requestHeaders: normalizeHeaders(err.config?.headers),
                          responseHeaders: normalizeHeaders(err.response?.headers),
                      }
                    : {}),
            };
        },
        setupFailure(apiError): void {
            result = {
                status: "error",
                error: apiError,
                statusCode: null,
                duration: elapsed(),
            };
        },
        end(): void {
            if (id === null) return;
            devtoolsBridge.onRequestEnd(id, result ?? { status: "aborted", duration: elapsed() });
        },
    };
}
