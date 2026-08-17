import { debounceFn, DebounceCancelledError } from "./utils/debounce";
import { parseUrlQueryParams } from "./utils/urlUtils";
import { type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";
import { ref, computed, effectScope, getCurrentInstance, getCurrentScope, nextTick, onScopeDispose, toValue, watch, useId, type MaybeRefOrGetter } from "vue";

import type {
    ApiError,
    UseApiOptions,
    UseApiReturn,
    ExecuteConfig,
} from "./types";
import { useApiConfig } from "./plugin";
import { parseApiError } from "./utils/errorParser";
import { useApiState } from "./composables/useApiState";
import { useAbortController } from "./composables/useAbortController";
import {
    readCacheEntry,
    writeCache,
    invalidateCache as cacheInvalidate,
    normalizeCacheOptions,
    resolveCacheKey,
} from "./features/cacheManager";
import { DEFAULT_RETRY_STATUS_CODES, resolveMaxRetries, shouldRetry } from "./features/retryPolicy";
import { cancellableSleep } from "./utils/time";
import { contentTypeForBody } from "./utils/headerUtils";
import { useRefetchTriggers } from "./composables/useRefetchTriggers";
import { usePolling } from "./composables/usePolling";
import { devtoolsBridge, nextRequestId } from "./devtools";
import { createRequestTrace, instrumentInstance } from "./devtools.instrumentation";

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
        coalesce = globalOptions?.coalesce ?? true,
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

    const toApiError = (err: unknown): ApiError => (errorParser ? errorParser(err) : parseApiError(err));

    const startLoading = initialLoading ?? immediate;
    const state = useApiState<TSelected>(initialData as TSelected | null, { initialLoading: startLoading });
    const revalidating = ref(false);
    const cacheKey = ref<string | null>(null);

    // Devtools: register this instance and mirror its state
    const instanceId = getCurrentInstance() != null ? useId() : nextRequestId();
    instrumentInstance(instanceId, toValue(url), options, globalOptions?.cacheDefaults, state);

    const abortController = ref<AbortController | null>(null);
    const globalAbort = useGlobalAbort ? useAbortController() : null;
    // notifyFetched is reassigned after reset() is defined — see useRefetchTriggers wiring below
    let notifyFetched: () => void = () => {};

    // Polling timer, visibility handling and interval changes — see usePolling.
    // Both callbacks are late-bound: execute/scheduleAutoTrigger are defined below.
    const polling = usePolling(poll, {
        loading: state.loading,
        run: () => { void execute(); },
        runCoalesced: () => scheduleAutoTrigger(),
    });

    const executeRequest = async (config?: ExecuteConfig<D>): Promise<TSelected | null> => {
        // Any actual execution (manual, poll tick, refetch trigger, or the
        // scheduled coalesced send itself) supersedes a pending auto-trigger.
        autoTriggerPending = false;
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
        const effectiveMaxRetries = resolveMaxRetries(config?.retry ?? retry);

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

        // A FormData / URLSearchParams body must not inherit the client's
        // application/json default — that default silently rewrites the body.
        // Per-call headers replace composable-level ones wholesale, matching the
        // spread order in the request below.
        const requestHeaders = configAxios.headers ?? axiosConfig.headers;
        const bodyContentType = contentTypeForBody(resolvedData, requestHeaders);

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
        polling.stop();

        if (abortController.value) abortController.value.abort("Cancelled by new request");
        const controller = new AbortController();
        abortController.value = controller;

        /** An abort/cancel rather than a real failure — the caller bails out silently. */
        const isCancellation = (err: unknown): boolean =>
            controller.signal.aborted || (isAxiosError(err) && err.code === "ERR_CANCELED");

        /**
         * Terminal failure path, shared by the request loop and the setup-level catch:
         * notify → set state → run callbacks. Devtools reporting differs between the
         * two (post-flight headers vs none), so the caller records the trace first.
         */
        const surfaceError = (apiError: ApiError, err: unknown): null => {
            if (!effectiveSkipErrorNotification && globalErrorHandler) {
                globalErrorHandler(apiError, err);
            }
            state.setError(apiError);
            state.setStatusCode(apiError.status);
            onError?.(apiError);
            config?.onError?.(apiError);
            return null;
        };

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

        const trace = createRequestTrace(instanceId);
        let devtoolsRequestId: string | null = null;

        try {
            if (!requestUrl) {
                throw new Error("Request URL is missing");
            }

            // Devtools: record the outgoing request
            devtoolsRequestId = trace.start({
                url: requestUrl,
                method,
                payload: resolvedData ?? null,
                // Parse query params from the URL string as fallback when params weren't passed as an option
                queryParams: resolvedParams ?? parseUrlQueryParams(requestUrl),
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
                        ...(bodyContentType
                            ? { headers: { ...requestHeaders, "Content-Type": bodyContentType } }
                            : {}),
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
                    trace.success(response, cacheWrittenAt);
                    return selected;

                } catch (err: unknown) {
                    // Abort / cancel — bail out silently
                    if (isCancellation(err)) {
                        wasCancelled = true;
                        return null;
                    }

                    const apiError = toApiError(err);

                    if (shouldRetry(retryCount, effectiveMaxRetries, effectiveRetryStatusCodes, apiError.status)) {
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
                    trace.failure(apiError, err);
                    return surfaceError(apiError, err);
                }
            }
        } catch (err: unknown) {
            // Handles "Request URL is missing" and unexpected setup errors (not retried)
            if (isCancellation(err)) {
                wasCancelled = true;
                return null;
            }
            const apiError = toApiError(err);
            trace.setupFailure(apiError);
            return surfaceError(apiError, err);
        } finally {
            trace.end();
            if (globalAbortHandler && subscribedSignal) subscribedSignal.removeEventListener("abort", globalAbortHandler);
            revalidating.value = false;
            if (!wasCancelled) {
                if (!isRevalidating) state.setLoading(false);
                onFinish?.();
                config?.onFinish?.();

                // Polling — the next tick is scheduled only after the final result
                // (success or all retries exhausted)
                polling.scheduleNext();
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

    // -------------------------------------------------------------------------
    // Auto-trigger coalescing — same-flush triggers collapse into one request
    // sent on nextTick with the final getter values (see `coalesce` option).
    // -------------------------------------------------------------------------
    let autoTriggerPending = false;
    let disposed = false;

    // Dev-only detector for the double-request pattern when coalescing is off
    let autoTriggersThisTick = 0;
    let warnedDoubleTrigger = false;
    const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

    const scheduleAutoTrigger = (): void => {
        if (!coalesce) {
            if (isDev && !warnedDoubleTrigger) {
                autoTriggersThisTick++;
                if (autoTriggersThisTick === 1) {
                    nextTick(() => { autoTriggersThisTick = 0; });
                } else {
                    warnedDoubleTrigger = true;
                    console.warn(
                        `[vue-muza-use] ${autoTriggersThisTick} auto-triggered requests to "${toValue(url)}" within one tick — ` +
                        "likely a watcher resetting deps this request reads (e.g. page/sort reset on filter change). " +
                        "Earlier requests are aborted but still reach the server. " +
                        "Remove `coalesce: false` to send a single request with the final values.",
                    );
                }
            }
            execute();
            return;
        }
        if (autoTriggerPending) return;
        autoTriggerPending = true;
        nextTick(() => {
            // Cleared flag = superseded by a manual execute()/poll tick meanwhile
            if (!autoTriggerPending) return;
            autoTriggerPending = false;
            if (disposed) return;
            execute();
        });
    };

    const abort = (msg?: string) => {
        polling.stop();
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
                () => scheduleAutoTrigger(),
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

    // A manual execute() must win over auto-triggers from deps mutated earlier
    // in the same tick: the pending flag handles an already-scheduled send, and
    // restarting the tracking scope (same mechanism as ignoreUpdates) turns the
    // watcher job already queued for this flush into a no-op.
    const publicExecute: typeof executeRequest = (config?) => {
        autoTriggerPending = false;
        if (!disposed && !lazy && trackingScope) {
            trackingScope.stop();
            startAutoTracking();
        }
        return execute(config);
    };

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
            disposed = true;
            abort("Scope disposed");
            devtoolsBridge.onInstanceDestroyed(instanceId);
        });
    }

    // Initial check for polling if immediate is false but pollInterval is set?
    // Usually polling requires one execution to start the loop in this logic.
    // If immediate=true, it starts.
    // Best-effort coalescing for the initial send: when no flush is pending at
    // setup time, nextTick may resolve before a same-tick dep mutation's flush,
    // yielding one extra (aborted) request — graceful degradation, payloads stay correct.
    if (immediate) scheduleAutoTrigger();

    return { ...state, revalidating, cacheKey, execute: publicExecute, abort, reset, ignoreUpdates };
}
