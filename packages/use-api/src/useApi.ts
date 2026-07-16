import { debounceFn, DebounceCancelledError } from "./utils/debounce";
import { parseUrlQueryParams } from "./utils/urlUtils";
import { type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";
import { ref, computed, effectScope, getCurrentInstance, getCurrentScope, onScopeDispose, toValue, watch, useId, type MaybeRefOrGetter } from "vue";

import type {
    UseApiOptions,
    UseApiReturn,
    ApiRequestConfig,
    ExecuteConfig,
    CacheOptions,
} from "./types";
import { useApiConfig } from "./plugin";
import { parseApiError } from "./utils/errorParser";
import { useApiState } from "./composables/useApiState";
import { useAbortController } from "./composables/useAbortController";
import { readCacheEntry, writeCache, invalidateCache as cacheInvalidate, DEFAULT_STALE_TIME } from "./features/cacheManager";
import { parseDuration } from "./utils/time";
import { stableStringify } from "./utils/stableStringify";
import { normalizeHeaders } from "./utils/headerUtils";
import { useRefetchTriggers } from "./composables/useRefetchTriggers";
import { devtoolsBridge, nextRequestId, isDevtoolsExpected } from "./devtools";
import type { RequestEndResult } from "./types";

const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

type NormalizedCache = { id?: string; staleTime: number; swr: boolean; freshFor: number };

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
 * when absent the key is derived automatically by `resolveCacheKey`.
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
 * Cancellable sleep — resolves `true` if aborted before delay elapsed, `false` otherwise.
 */
function cancellableSleep(ms: number, signal: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        if (signal.aborted) { resolve(true); return; }
        const timer = setTimeout(() => { cleanup(); resolve(false); }, ms);
        const onAbort = () => { clearTimeout(timer); cleanup(); resolve(true); };
        const cleanup = () => signal.removeEventListener("abort", onAbort);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

export function useApi<T = unknown, D = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options: UseApiOptions<T, D, TSelected> = {},
): UseApiReturn<TSelected, D> {
    const { axios, onError: globalErrorHandler, globalOptions, errorParser } = useApiConfig();

    const {
        method = "GET",
        immediate = false,
        onSuccess,
        onError,
        onBefore,
        onFinish,
        initialData = null,
        debounce = 0,
        skipErrorNotification = false,
        retry = globalOptions?.retry ?? false,
        retryDelay = globalOptions?.retryDelay ?? 1000,
        retryStatusCodes = globalOptions?.retryStatusCodes ?? DEFAULT_RETRY_STATUS_CODES,
        authMode = "default",
        useGlobalAbort = globalOptions?.useGlobalAbort ?? true,
        initialLoading,
        poll = 0,
        // Explicitly excluded from axiosConfig — these are useApi-only options
        // and must not be forwarded to axios.request()
        cache: _cache,
        invalidateCache: _invalidateCache,
        lazy = false,
        refetchOnFocus: _refetchOnFocus,
        refetchOnReconnect: _refetchOnReconnect,
        select,
        ...axiosConfig
    } = options;

    const applySelect = (raw: T): TSelected =>
        select ? select(raw) : (raw as unknown as TSelected);

    const startLoading = initialLoading ?? immediate;
    const state = useApiState<TSelected>(initialData as TSelected | null, { initialLoading: startLoading });
    const revalidating = ref(false);
    const cacheKey = ref<string | null>(null);

    // Devtools: track this instance
    const instanceId = getCurrentInstance() != null ? useId() : nextRequestId();
    devtoolsBridge.onInstanceCreated(instanceId, toValue(url), {
        authMode: options.authMode ?? "default",
        // Resolved snapshot (cacheDefaults merged in), not the raw `options.cache` —
        // otherwise `cache: true` shows as a bare, meaningless value in devtools and
        // swr/freshFor inherited from cacheDefaults would be invisible.
        cache: normalizeCacheOptions(options.cache, undefined, globalOptions?.cacheDefaults),
        retry: options.retry ?? false,
        poll: (() => { const v = toValue(options.poll); return typeof v === "number" ? v : 0; })(),
        immediate: options.immediate ?? false,
        lazy: options.lazy ?? false,
    });
    if (getCurrentScope() && isDevtoolsExpected()) {
        watch(
            () => ({
                loading: state.loading.value,
                error: state.error.value,
                statusCode: state.statusCode.value,
                data: state.data.value,
            }),
            (s) => devtoolsBridge.onStateUpdate(instanceId, s),
            { deep: true },
        );
    }

    const abortController = ref<AbortController | null>(null);
    const globalAbort = useGlobalAbort ? useAbortController() : null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    // notifyFetched is reassigned after reset() is defined — see useRefetchTriggers wiring below
    let notifyFetched: () => void = () => {};

    // Helper to resolve poll config
    const getPollConfig = () => {
        const val = toValue(poll);
        if (typeof val === "number") return { interval: val, whenHidden: false };
        if (val && typeof val === "object") {
            return {
                interval: toValue(val.interval),
                whenHidden: toValue(val.whenHidden) ?? false
            };
        }
        return { interval: 0, whenHidden: false };
    };

    const executeRequest = async (config?: ExecuteConfig<D>): Promise<TSelected | null> => {
        /**
         * Cache hit behavior (cache.swr: false — default):
         * - mutate() called with cached data
         * - loading set to false (clears the initialLoading/immediate preset)
         * - onBefore / onSuccess / onFinish NOT called
         * - axios request NOT made
         *
         * Cache hit behavior (cache.swr: true — SWR):
         * - mutate() called with cached data immediately (no loading flash)
         * - entry age < freshFor → treated like a non-SWR hit: NO request,
         *   revalidating stays false (default freshFor: 0 = always revalidate)
         * - otherwise: revalidating set to true
         * - axios request IS made in the background
         * - on success: data updated silently, revalidating: false
         * - on error: error set, revalidating: false
         *
         * Cache write: only on HTTP 2xx success
         * Cache invalidation: only on HTTP 2xx success
         *
         * staleTime default: 300_000ms (5 minutes)
         * Expired entries are deleted on next read attempt
         *
         * The cache is module-level (singleton).
         * All useApi instances in the app share the same cache.
         * Use clearAllCache() on logout to prevent data leaks between users.
         */
        const cacheOpts = normalizeCacheOptions(options.cache, config?.cache, globalOptions?.cacheDefaults);
        let isRevalidating = false;

        const effectiveSkipErrorNotification = config?.skipErrorNotification ?? skipErrorNotification;
        const effectiveRetryDelay = config?.retryDelay ?? retryDelay;
        const effectiveRetryStatusCodes = config?.retryStatusCodes ?? retryStatusCodes;
        const effectiveMaxRetries = (() => {
            const r = config?.retry ?? retry;
            return r === false ? 0 : r === true ? 3 : (r as number);
        })();

        // Per-call config must get the same filtering as setup-time options:
        // useApi-only keys must never reach axios.request(). authMode/data/params
        // are also excluded here (unlike the setup-time list above) because they're
        // re-applied explicitly below via resolvedData/resolvedParams/the authMode
        // spread — this list is not meant to mirror the setup-time one key-for-key.
        const {
            cache: _cfgCache,
            invalidateCache: _cfgInvalidateCache,
            retry: _cfgRetry,
            retryDelay: _cfgRetryDelay,
            retryStatusCodes: _cfgRetryStatusCodes,
            skipErrorNotification: _cfgSkip,
            onBefore: _cfgOnBefore,
            onSuccess: _cfgOnSuccess,
            onError: _cfgOnError,
            onFinish: _cfgOnFinish,
            authMode: _cfgAuthMode,
            data: _cfgData,
            params: _cfgParams,
            ...configAxios
        } = config ?? {};

        // Resolve request inputs up-front: the auto cache key is derived from
        // method + url + params + data, so all three must be known before the
        // cache read below. (These were previously resolved later, inside the
        // try block — hoisting is safe: toValue runs in this imperative body,
        // not inside the reactive tracking scope.)
        const requestUrl = toValue(url);
        const rawData = config?.data !== undefined ? config.data : axiosConfig.data;
        const resolvedData = toValue(rawData);
        const rawParams = config?.params !== undefined ? config.params : axiosConfig.params;
        const resolvedParams = toValue(rawParams);

        // Concrete cache key: manual id (no url needed) or auto key (needs url).
        const key =
            cacheOpts && (cacheOpts.id !== undefined || requestUrl)
                ? resolveCacheKey(cacheOpts, method, requestUrl ?? "", resolvedParams, resolvedData)
                : null;
        cacheKey.value = key;

        if (cacheOpts && key !== null) {
            const cached = readCacheEntry<T>(key);
            if (cached !== null) {
                state.mutate(applySelect(cached.data));
                // Clear loading preset by initialLoading/immediate — data is already
                // served; neither the early return below nor the SWR revalidation
                // path (finally skips setLoading when isRevalidating) would reset it
                state.setLoading(false);
                // Fresh SWR hits (age < freshFor) behave exactly like non-SWR hits:
                // no background request, revalidating stays false
                if (!cacheOpts.swr || cached.ageMs < cacheOpts.freshFor) {
                    return applySelect(cached.data);
                }
                // SWR: serve cache immediately, continue to fetch fresh data in background
                isRevalidating = true;
                revalidating.value = true;
            }
        }

        // Clear previous poll timer to avoid overlaps if manual execute happened
        if (pollTimer) clearTimeout(pollTimer);

        if (abortController.value) abortController.value.abort("Cancelled by new request");
        const controller = new AbortController();
        abortController.value = controller;

        // Chain external signal → internal controller so batch abort reaches Axios
        if (config?.signal) {
            const signal = config.signal as unknown as AbortSignal;
            if (signal.aborted) {
                controller.abort(signal.reason);
            } else {
                signal.addEventListener('abort', () => {
                    controller.abort(signal.reason);
                }, { once: true });
            }
        }

        // --- Global Abort Logic ---
        let globalAbortHandler: (() => void) | null = null;
        let subscribedSignal: AbortSignal | null = null;
        if (globalAbort) {
            const gs = globalAbort.getSignal();
            if (!gs.aborted) {
                subscribedSignal = gs;
                // The event listener is already scoped to this specific signal instance —
                // no need to compare abortCount. The signal fires exactly once per abort() call.
                globalAbortHandler = () => { controller.abort("Cancelled by global abort"); };
                gs.addEventListener("abort", globalAbortHandler);
            }
        }
        // -------------------------------------------------------------------------

        // During revalidation we already have data — don't show loading spinner
        if (!isRevalidating) {
            onBefore?.();
            config?.onBefore?.();
            state.setLoading(true);
        }
        state.setError(null);

        let wasCancelled = false;
        let retryCount = 0;

        let devtoolsRequestId: string | null = null;
        let devtoolsRequestStartedAt = 0;
        let devtoolsRequestEndResult: RequestEndResult | null = null;

        try {
            if (!requestUrl) {
                throw new Error("Request URL is missing");
            }

            // Parse query params from the URL string as fallback when params weren't passed as an option
            const devtoolsQueryParams: unknown = resolvedParams ?? parseUrlQueryParams(requestUrl);

            // Devtools: record the outgoing request
            devtoolsRequestId = nextRequestId();
            devtoolsRequestStartedAt = Date.now();
            devtoolsBridge.onRequestStart({
                id: devtoolsRequestId,
                instanceId,
                url: requestUrl,
                method,
                startedAt: devtoolsRequestStartedAt,
                status: "pending",
                statusCode: null,
                requestHeaders: {},
                payload: resolvedData ?? null,
                queryParams: devtoolsQueryParams,
                cacheKey: key,
            });

            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    const response = await axios.request<T>({
                        url: requestUrl,
                        method,
                        ...axiosConfig,
                        ...configAxios,
                        data: resolvedData,
                        params: resolvedParams,
                        signal: controller.signal,
                        // _devtoolsRequestId lets the 401-refresh interceptor flag this
                        // request's devtools record when it is transparently retried
                        ...({ authMode: config?.authMode || authMode, _devtoolsRequestId: devtoolsRequestId } as unknown as AxiosRequestConfig),
                    } as AxiosRequestConfig);

                    const selected = applySelect(response.data);
                    // response is AxiosResponse<T>; state is typed TSelected — cast is safe
                    // because UseApiReturn.response is Ref<AxiosResponse<unknown>>
                    state.mutate(selected, response as unknown as AxiosResponse<TSelected>);
                    state.setStatusCode(response.status);

                    // Cache WRITE — only on 2xx success; always store raw data
                    let cacheWrittenAt: number | undefined;
                    if (cacheOpts && key !== null) {
                        writeCache(key, response.data, cacheOpts.staleTime);
                        cacheWrittenAt = Date.now();
                    }

                    // Cache INVALIDATION — only on 2xx success, never in catch/finally
                    // per-call config takes precedence over composable-level
                    const invalidateCacheOption = config?.invalidateCache ?? options.invalidateCache;
                    if (invalidateCacheOption) {
                        cacheInvalidate(invalidateCacheOption);
                    }

                    onSuccess?.(response);
                    config?.onSuccess?.(response);
                    notifyFetched(); // reset focus-throttle clock — only on success, not on error
                    devtoolsRequestEndResult = {
                        status: "success",
                        statusCode: response.status,
                        response: response.data,
                        duration: Date.now() - devtoolsRequestStartedAt,
                        ...(cacheWrittenAt !== undefined ? { cachedAt: cacheWrittenAt } : {}),
                        // Headers exist only post-flight (interceptors mutate config.headers),
                        // so they're captured at end — not in onRequestStart
                        ...(isDevtoolsExpected()
                            ? {
                                  requestHeaders: normalizeHeaders(response.config?.headers),
                                  responseHeaders: normalizeHeaders(response.headers),
                              }
                            : {}),
                    };
                    return selected;

                } catch (err: unknown) {
                    // Abort / cancel — bail out silently
                    if (controller.signal.aborted || (isAxiosError(err) && err.code === "ERR_CANCELED")) {
                        wasCancelled = true;
                        return null;
                    }

                    const apiError = errorParser ? errorParser(err) : parseApiError(err);

                    const canRetry =
                        retryCount < effectiveMaxRetries &&
                        (effectiveRetryStatusCodes.length === 0 || effectiveRetryStatusCodes.includes(apiError.status));

                    if (canRetry) {
                        retryCount++;
                        const aborted = await cancellableSleep(effectiveRetryDelay, controller.signal);
                        if (aborted) {
                            // Explicitly reset loading — abort during sleep leaves no in-flight request
                            wasCancelled = true;
                            state.setLoading(false);
                            return null;
                        }
                        continue;
                    }

                    // All retries exhausted (or retry disabled) — surface the error
                    devtoolsRequestEndResult = {
                        status: "error",
                        error: apiError,
                        statusCode: apiError.status ?? null,
                        duration: Date.now() - devtoolsRequestStartedAt,
                        ...(isDevtoolsExpected() && isAxiosError(err)
                            ? {
                                  requestHeaders: normalizeHeaders(err.config?.headers),
                                  responseHeaders: normalizeHeaders(err.response?.headers),
                              }
                            : {}),
                    };
                    if (!effectiveSkipErrorNotification && globalErrorHandler) {
                        globalErrorHandler(apiError, err);
                    }
                    state.setError(apiError);
                    state.setStatusCode(apiError.status);
                    onError?.(apiError);
                    config?.onError?.(apiError);
                    return null;
                }
            }
        } catch (err: unknown) {
            // Handles "Request URL is missing" and unexpected setup errors (not retried)
            if (controller.signal.aborted || (isAxiosError(err) && err.code === "ERR_CANCELED")) {
                wasCancelled = true;
                return null;
            }
            const apiError = errorParser ? errorParser(err) : parseApiError(err);
            devtoolsRequestEndResult = {
                status: "error",
                error: apiError,
                statusCode: null,
                duration: Date.now() - devtoolsRequestStartedAt,
            };
            if (!effectiveSkipErrorNotification && globalErrorHandler) {
                globalErrorHandler(apiError, err);
            }
            state.setError(apiError);
            state.setStatusCode(apiError.status);
            onError?.(apiError);
            config?.onError?.(apiError);
            return null;
        } finally {
            if (devtoolsRequestId !== null) {
                devtoolsBridge.onRequestEnd(
                    devtoolsRequestId,
                    devtoolsRequestEndResult ?? { status: "aborted", duration: Date.now() - devtoolsRequestStartedAt },
                );
            }
            if (globalAbortHandler && subscribedSignal) subscribedSignal.removeEventListener("abort", globalAbortHandler);
            revalidating.value = false;
            if (!wasCancelled) {
                if (!isRevalidating) state.setLoading(false);
                onFinish?.();
                config?.onFinish?.();

                // Polling Logic — starts only after the final result (success or all retries exhausted)
                const { interval, whenHidden } = getPollConfig();
                if (interval > 0) {
                    const shouldPoll = whenHidden || (typeof document !== "undefined" && !document.hidden);
                    if (shouldPoll) {
                        pollTimer = setTimeout(() => {
                            pollTimer = null;
                            const { whenHidden: currentWhenHidden } = getPollConfig();
                            if (currentWhenHidden || (typeof document === "undefined" || !document.hidden)) {
                                execute();
                            }
                        }, interval);
                    }
                }
            }
        }
    };

    // When debounce is active, superseded calls are rejected with DebounceCancelledError.
    // Swallow it here so callers of execute() always get null (not an unhandled rejection).
    const _debounced = debounce > 0 ? debounceFn(executeRequest, debounce) : null;
    const execute: typeof executeRequest = _debounced
        ? (config?) => _debounced(config).catch((err) => {
            if (err instanceof DebounceCancelledError) return null;
            throw err;
        })
        : executeRequest;

    const abort = (msg?: string) => {
        if (pollTimer) clearTimeout(pollTimer);
        abortController.value?.abort(msg);
        abortController.value = null;
    };

    const reset = () => {
        abort();
        state.reset();
        state.setLoading(false);
    };

    // -------------------------------------------------------------------------
    // Refetch triggers — focus + reconnect
    // -------------------------------------------------------------------------
    const refetchOnFocus = _refetchOnFocus ?? globalOptions?.refetchOnFocus;
    const refetchOnReconnect = _refetchOnReconnect ?? globalOptions?.refetchOnReconnect;

    const { notifyFetched: _notifyFetched } = useRefetchTriggers({
        refetchOnFocus,
        refetchOnReconnect,
        loading: state.loading,
        onTrigger: () => execute(),
    });
    notifyFetched = _notifyFetched;

    let trackingScope: ReturnType<typeof effectScope> | undefined

    const startAutoTracking = () => {
        trackingScope = effectScope()
        trackingScope.run(() => {
            const urlComputed    = computed(() => toValue(url))
            const paramsComputed = computed(() => toValue(options.params))
            const dataComputed   = computed(() => toValue(options.data))

            watch(
                [urlComputed, paramsComputed, dataComputed],
                () => execute(),
                { flush: 'pre', deep: true },
            )
        })
    }

    if (!lazy) {
        startAutoTracking()

        if (getCurrentScope()) {
            onScopeDispose(() => trackingScope!.stop())
        }
    }

    const ignoreUpdates = (updater: () => void): void => {
        trackingScope?.pause()
        try {
            updater()
        } finally {
            // resume() re-queues any effects dirtied during the pause.
            // We immediately stop the scope so those queued jobs are no-ops
            // (the job checks effect.flags & 1 before running), then restart
            // fresh tracking so subsequent dep changes fire normally.
            trackingScope?.resume()
            trackingScope?.stop()
            if (!lazy) startAutoTracking()
        }
    }

    if (getCurrentScope()) {
        onScopeDispose(() => {
            abort("Scope disposed");
            devtoolsBridge.onInstanceDestroyed(instanceId);
        });
    }

    // Initial check for polling if immediate is false but pollInterval is set?
    // Usually polling requires one execution to start the loop in this logic.
    // If immediate=true, it starts.
    if (immediate) execute();

    // Visibility Handling for Polling — only when polling is configured.
    // `poll` may be a ref/getter (always truthy) — that's fine: the handler
    // itself re-reads getPollConfig() and no-ops when the interval is 0.
    if (poll && typeof document !== "undefined") {
        const handleVisibility = () => {
            if (document.hidden) return;
            // On tab focus, if polling is enabled and no timer is running, resume/catch-up
            const { interval } = getPollConfig();
            if (interval > 0 && !pollTimer && !state.loading.value) {
                 execute();
            }
        };
        // We use a simple listener. In a real app, might want to use useEventListener from vueuse if available, but native is fine.
        document.addEventListener("visibilitychange", handleVisibility);

        if (getCurrentScope()) {
            onScopeDispose(() => document.removeEventListener("visibilitychange", handleVisibility));
        }
    }

    // Watch for dynamic poll changes
    if (poll) {
         watch(() => toValue(poll), () => {
             const { interval } = getPollConfig();

             if (interval > 0) {
                 // If timer is running, we want to restart with new interval
                 if (pollTimer) {
                     clearTimeout(pollTimer);
                     pollTimer = null;
                 }
                 // If we are idle (not loading), start immediately to apply new settings
                 if (!state.loading.value) {
                     execute();
                 }
             } else {
                 // If disabled, clear any pending timer
                 if (pollTimer) {
                     clearTimeout(pollTimer);
                     pollTimer = null;
                 }
             }
         }, { deep: true });
    }

    return { ...state, revalidating, cacheKey, execute, abort, reset, ignoreUpdates };
}
