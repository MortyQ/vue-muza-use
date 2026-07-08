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
import { useRefetchTriggers } from "./composables/useRefetchTriggers";
import { devtoolsBridge, nextRequestId, isDevtoolsExpected } from "./devtools";
import type { RequestEndResult } from "./types";

const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Normalise the `cache` option into a consistent shape with guaranteed `staleTime`,
 * `swr` and `freshFor` values (duration strings resolved to milliseconds).
 * Returns null if caching is not configured.
 */
function normalizeCacheOptions(
    cache: string | CacheOptions | undefined,
): { id: string; staleTime: number; swr: boolean; freshFor: number } | null {
    if (!cache) return null;
    if (typeof cache === "string") {
        return { id: cache, staleTime: DEFAULT_STALE_TIME, swr: false, freshFor: 0 };
    }
    return {
        id: cache.id,
        staleTime: cache.staleTime !== undefined ? parseDuration(cache.staleTime) : DEFAULT_STALE_TIME,
        swr: cache.swr ?? false,
        freshFor: cache.freshFor !== undefined ? parseDuration(cache.freshFor) : 0,
    };
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

    // Devtools: track this instance
    const instanceId = getCurrentInstance() != null ? useId() : nextRequestId();
    devtoolsBridge.onInstanceCreated(instanceId, toValue(url), {
        authMode: options.authMode ?? "default",
        cache: options.cache,
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
         * - loading stays false
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
        const cacheOpts = normalizeCacheOptions(config?.cache ?? options.cache);
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

        if (cacheOpts) {
            const cached = readCacheEntry<T>(cacheOpts.id);
            if (cached !== null) {
                state.mutate(applySelect(cached.data));
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
        const requestUrl = toValue(url);

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

            const rawData = config?.data !== undefined ? config.data : axiosConfig.data;
            const resolvedData = toValue(rawData);

            const rawParams = config?.params !== undefined ? config.params : axiosConfig.params;
            const resolvedParams = toValue(rawParams);

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
                        ...({ authMode: config?.authMode || authMode } as unknown as AxiosRequestConfig),
                    } as AxiosRequestConfig);

                    const selected = applySelect(response.data);
                    // response is AxiosResponse<T>; state is typed TSelected — cast is safe
                    // because UseApiReturn.response is Ref<AxiosResponse<unknown>>
                    state.mutate(selected, response as unknown as AxiosResponse<TSelected>);
                    state.setStatusCode(response.status);

                    // Cache WRITE — only on 2xx success; always store raw data
                    if (cacheOpts) {
                        writeCache(cacheOpts.id, response.data, cacheOpts.staleTime);
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

    return { ...state, revalidating, execute, abort, reset, ignoreUpdates };
}
