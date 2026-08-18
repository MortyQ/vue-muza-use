import { ref, computed, effectScope, getCurrentScope, onScopeDispose, toValue, watch, type Ref, type MaybeRefOrGetter } from "vue";
import type { AxiosResponse } from "axios";
import { useApi } from "./useApi";
import { useApiConfig } from "./plugin";
import { useRefetchTriggers } from "./composables/useRefetchTriggers";
import { normalizeCacheOptions, resolveCacheKey, readCacheEntry } from "./features/cacheManager";
import type {
    UseApiBatchOptions,
    UseApiBatchReturn,
    BatchResultItem,
    BatchRequestConfig,
    BatchProgress,
    ApiError,
    ApiRequestConfig,
} from "./types";

/**
 * Normalize a string or BatchRequestConfig to a full BatchRequestConfig.
 * Strings become GET requests with no body or params.
 */
function normalizeRequest(item: string | BatchRequestConfig): BatchRequestConfig {
    if (typeof item === 'string') return { url: item, method: 'GET' };
    return { method: 'GET', ...item };
}

/**
 * One unit of network work for a run of the batch.
 * `revalidate` jobs already published cached data and are refreshing it in the
 * background; their failure must not wipe what is on screen.
 */
interface BatchJob<T> {
    config: BatchRequestConfig;
    index: number;
    revalidate: boolean;
    /** Cached value already published for this index — only set when `revalidate`. */
    cached: T | null;
}

/**
 * Execute multiple API requests in parallel with full reactive state
 *
 * Features:
 * - Reactive loading, data, error, progress states
 * - Reactive request list support (MaybeRefOrGetter)
 * - Per-request method, data, params, headers configuration
 * - Full backward compatibility — plain string arrays still work
 * - Error tolerance with `settled: true` (default)
 * - Concurrency limiting
 * - Abort support for all pending requests
 * - Detailed per-request results with URL mapping
 * - Progress tracking
 * - Auto-tracking for reactive getter requests (lazy: false default)
 *
 * @example
 * ```ts
 * // Basic usage — plain strings (backward compatible)
 * const { data, execute } = useApiBatch(['/users/1', '/users/2'])
 *
 * // Per-request config — method, data, params, headers
 * const { data } = useApiBatch([
 *   { url: '/users', params: { page: 1 } },
 *   { url: '/posts', method: 'POST', data: { title: 'New' } },
 *   '/health',  // string and object can be mixed
 * ])
 *
 * // Batch DELETE by IDs
 * const ids = [1, 2, 3]
 * useApiBatch(ids.map(id => ({ url: `/users/${id}`, method: 'DELETE' })))
 *
 * // Reactive getter — auto-tracks deps, re-executes when pages changes
 * const pages = ref([1, 2, 3])
 * const { successfulData } = useApiBatch(
 *   () => pages.value.map(page => ({ url: '/users', params: { page } }))
 * )
 *
 * // Per-request caching (auto-keyed) + per-item response transform
 * const { successfulData } = useApiBatch<User, { data: User }>(
 *   ['/users/1', '/users/2'],
 *   { cache: { staleTime: '5m' }, select: (res) => res.data },
 * )
 * ```
 *
 * @typeParam T - Type of each item's data after `select` (defaults to the raw response)
 * @typeParam TRaw - Raw response type before `select`
 */
export function useApiBatch<T = unknown, TRaw = unknown>(
    requests: MaybeRefOrGetter<Array<string | BatchRequestConfig>>,
    options: UseApiBatchOptions<T, unknown, TRaw> = {},
): UseApiBatchReturn<T> {
    const {
        settled = true,
        concurrency,
        immediate = false,
        skipErrorNotification = true,
        lazy = false,
        poll = 0,
        watch: watchSource,
        // Batch-level browser triggers — pulled out of `apiOptions` so the
        // per-request useApi instances (whose scopes are stopped as soon as the
        // request settles) never register listeners of their own.
        refetchOnFocus,
        refetchOnReconnect,
        onItemSuccess,
        onItemError,
        onFinish,
        onProgress,
        ...apiOptions
    } = options;

    // Helper to get current normalized request configs
    const getRequests = () => toValue(requests).map(normalizeRequest);

    // Reactive state
    const data = ref<BatchResultItem<T>[]>([]) as Ref<BatchResultItem<T>[]>;
    const loading = ref(false);
    const revalidating = ref(false);
    const error = ref<ApiError | null>(null);
    const errors = ref<ApiError[]>([]) as Ref<ApiError[]>;
    const progress = ref<BatchProgress>({
        completed: 0,
        total: 0,
        percentage: 0,
        succeeded: 0,
        failed: 0,
    });

    // Computed: extract only successful data
    const successfulData = computed<T[]>(() =>
        data.value
            .filter(item => item.success && item.data !== null)
            .map(item => item.data as T)
    );

    // Abort controllers for all active requests
    const abortControllers = ref<AbortController[]>([]);
    let isAborted = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    // Reassigned once useRefetchTriggers is wired below (it needs `execute`,
    // which in turn reports back here to reset the focus throttle clock).
    let notifyFetched: () => void = () => {};

    const getPollConfig = (): { interval: number; whenHidden: boolean } => {
        const val = toValue(poll);
        if (typeof val === 'number') return { interval: val, whenHidden: false };
        return {
            interval: toValue((val as { interval: MaybeRefOrGetter<number> }).interval),
            whenHidden: toValue((val as { whenHidden?: MaybeRefOrGetter<boolean> }).whenHidden) ?? false,
        };
    };

    // Run-scoped tallies — one run is active at a time (execute() aborts the previous one)
    let succeededCount = 0;
    let failedCount = 0;

    const pendingItem = (config: BatchRequestConfig, index: number): BatchResultItem<T> => ({
        url: config.url,
        index,
        success: false,
        status: 'pending',
        stale: false,
        data: null,
        error: null,
        statusCode: null,
        response: null,
        request: config,
    });

    /**
     * Publish an item into `data` without settling it — used for SWR cache hits,
     * which are on screen immediately but still awaiting their background refresh.
     * No progress tick and no callbacks: those belong to the final state.
     */
    const publishItem = (item: BatchResultItem<T>) => {
        data.value[item.index] = item;
    };

    /**
     * Publish an item as final: tally it, tick progress and fire its callback.
     */
    const settleItem = (item: BatchResultItem<T>, total: number) => {
        data.value[item.index] = item;

        if (item.success) {
            succeededCount++;
        } else {
            failedCount++;
            if (item.error) errors.value.push(item.error);
        }
        updateProgress(succeededCount, failedCount, total);

        if (item.success) {
            onItemSuccess?.(item, item.index);
        } else if (item.error) {
            onItemError?.(item, item.index);
        }
    };

    const updateProgress = (succeeded: number, failed: number, total: number) => {
        const completed = succeeded + failed;
        const newProgress: BatchProgress = {
            completed,
            total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            succeeded,
            failed,
        };
        progress.value = newProgress;
        onProgress?.(newProgress);
    };

    const applySelect = (raw: TRaw): T =>
        apiOptions.select ? apiOptions.select(raw) : (raw as unknown as T);

    /**
     * Resolve one request against the shared cache, mirroring the key useApi
     * would derive for it. Returns null when caching is off for this batch or
     * the entry is missing/expired; `stale` marks an SWR hit that still needs
     * a background refresh.
     */
    const readBatchCache = (config: BatchRequestConfig): { data: T; stale: boolean } | null => {
        if (!apiOptions.cache) return null;

        const { globalOptions } = useApiConfig();
        const normalized = normalizeCacheOptions(apiOptions.cache, undefined, globalOptions?.cacheDefaults);
        if (!normalized) return null;

        const key = resolveCacheKey(
            normalized,
            config.method ?? 'GET',
            config.url,
            toValue(config.params),
            toValue(config.data),
        );
        const entry = readCacheEntry<TRaw>(key);
        if (entry === null) return null;

        return {
            data: applySelect(entry.data),
            stale: normalized.swr && entry.ageMs >= normalized.freshFor,
        };
    };

    const executeRequest = async (
        job: BatchJob<T>,
        signal: AbortSignal
    ): Promise<BatchResultItem<T>> => {
        const { config, index } = job;
        const base = pendingItem(config, index);

        // A failed revalidation keeps the cached value on screen — but it is still
        // a failure: status 'error', the error surfaces in `errors` and onItemError,
        // and the item drops out of successfulData. `stale` says the data is old.
        const failure = (apiError: ApiError | null, code: number | null = null): BatchResultItem<T> => ({
            ...base,
            success: false,
            status: 'error',
            stale: job.revalidate,
            data: job.revalidate ? job.cached : null,
            error: apiError,
            statusCode: code,
        });

        // Each internal useApi instance gets its own effectScope so that
        // onScopeDispose, poll timers, and event listeners are properly cleaned up
        // even when executeRequest() runs outside a Vue component's setup context.
        const scope = effectScope();
        const api = scope.run(() => useApi<TRaw, unknown, T>(config.url, {
            ...apiOptions,
            method: config.method,
            data: config.data,
            params: config.params,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(config.headers && { headers: config.headers as any }),
            useGlobalAbort: false,
            skipErrorNotification,
            lazy: true,
        }))!;
        const { execute, error: reqError, statusCode, response } = api;

        try {
            const result = await execute({ signal } as ApiRequestConfig<unknown>);

            if (signal.aborted) {
                return failure({ message: 'Request aborted', status: 0, code: 'ABORTED' });
            }

            if (result === null || result === undefined) {
                return failure(reqError.value, statusCode.value);
            }

            return {
                ...base,
                success: true,
                status: 'success',
                stale: false,
                data: result,
                error: null,
                statusCode: statusCode.value,
                response: response.value as AxiosResponse<T> | null,
            };
        } catch (err) {
            return failure({
                message: err instanceof Error ? err.message : 'Unknown error',
                status: 0,
                code: 'BATCH_ERROR',
            });
        } finally {
            scope.stop();
        }
    };

    const executeWithConcurrency = async (
        jobs: BatchJob<T>[],
        limit: number | undefined,
        total: number
    ): Promise<void> => {
        const runJob = async (job: BatchJob<T>): Promise<void> => {
            const controller = new AbortController();
            abortControllers.value.push(controller);

            const item = await executeRequest(job, controller.signal);
            settleItem(item, total);

            // In non-settled mode, abort siblings then throw. A failed background
            // revalidation is not fatal — its item still holds usable cached data.
            if (!settled && !item.success && item.error && !job.revalidate) {
                abort('First request failed in non-settled mode');
                throw item.error;
            }
        };

        if (!limit || limit >= jobs.length) {
            // No limit - execute all in parallel
            const promises = jobs.map(job => runJob(job));

            if (settled) {
                await Promise.allSettled(promises);
            } else {
                await Promise.all(promises);
            }
        } else {
            // With concurrency limit
            let currentIndex = 0;

            const executeNext = async (): Promise<void> => {
                while (currentIndex < jobs.length && !isAborted) {
                    await runJob(jobs[currentIndex++]);
                }
            };

            // Start `limit` workers
            const workers = Array.from({ length: Math.min(limit, jobs.length) }, () => executeNext());

            if (settled) {
                await Promise.allSettled(workers);
            } else {
                await Promise.all(workers);
            }
        }
    };

    const execute = async (): Promise<BatchResultItem<T>[]> => {
        // Abort any in-flight execution before starting a new one
        if (loading.value || revalidating.value) {
            abort('Replaced by new execution');
        }

        const currentRequests = getRequests();

        // Reset state
        isAborted = false;
        error.value = null;
        errors.value = [];
        succeededCount = 0;
        failedCount = 0;
        abortControllers.value = [];
        const total = currentRequests.length;

        // Seed placeholders so `data` is indexable (and of the final length) while
        // requests are still in flight — items are published as they land.
        data.value = currentRequests.map((config, index) => pendingItem(config, index));
        updateProgress(0, 0, total);

        // Cache pass — an entry that needs no network is published right away;
        // an SWR hit is published as stale and queued for a background refresh.
        const jobs: BatchJob<T>[] = [];
        for (const [index, config] of currentRequests.entries()) {
            const hit = readBatchCache(config);

            if (hit === null) {
                jobs.push({ config, index, revalidate: false, cached: null });
                continue;
            }

            const item: BatchResultItem<T> = {
                ...pendingItem(config, index),
                success: true,
                status: 'success',
                stale: hit.stale,
                data: hit.data,
            };

            if (!hit.stale) {
                settleItem(item, total);
                continue;
            }

            publishItem(item);
            jobs.push({ config, index, revalidate: true, cached: hit.data });
        }

        loading.value = jobs.some(job => !job.revalidate);
        revalidating.value = jobs.some(job => job.revalidate);

        let finalResults: BatchResultItem<T>[] = [];
        try {
            await executeWithConcurrency(jobs, concurrency, total);
            finalResults = [...data.value];

            // Set aggregated error if all requests failed
            const allFailed = finalResults.every(r => !r.success);
            if (allFailed && finalResults.length > 0) {
                error.value = {
                    message: `All ${finalResults.length} requests failed`,
                    status: 0,
                    code: 'BATCH_ALL_FAILED',
                };
            }

            return finalResults;
        } catch (err) {
            // This happens in non-settled mode when first request fails
            if (!settled) {
                error.value = err as ApiError;
            }
            throw err;
        } finally {
            loading.value = false;
            revalidating.value = false;
            abortControllers.value = [];
            onFinish?.(finalResults);
            if (!isAborted) {
                notifyFetched();
                const { interval, whenHidden } = getPollConfig();
                if (interval > 0) {
                    const hidden = typeof document !== 'undefined' && document.hidden;
                    if (whenHidden || !hidden) {
                        pollTimer = setTimeout(() => {
                            pollTimer = null;
                            execute();
                        }, interval);
                    }
                }
            }
        }
    };

    const abort = (message = 'Batch aborted') => {
        isAborted = true;
        revalidating.value = false;
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        for (const controller of abortControllers.value) {
            controller.abort(message);
        }
        abortControllers.value = [];
    };

    const reset = () => {
        abort();
        loading.value = false;
        revalidating.value = false;
        error.value = null;
        errors.value = [];
        data.value = [];
        progress.value = {
            completed: 0,
            total: getRequests().length,
            percentage: 0,
            succeeded: 0,
            failed: 0,
        };
    };

    // Browser triggers — batch-level: one listener re-runs the whole batch.
    // Not inherited from globalOptions (see UseApiBatchOptions.refetchOnFocus).
    const { notifyFetched: reportFetched } = useRefetchTriggers({
        refetchOnFocus,
        refetchOnReconnect,
        // A batch that is only revalidating still counts as busy for the triggers
        loading: computed(() => loading.value || revalidating.value),
        // In non-settled mode execute() rejects — the error is already exposed
        // via `error`/`errors`, so swallow it here to avoid an unhandled rejection.
        onTrigger: () => { void execute().catch(() => {}); },
    });
    notifyFetched = reportFetched;

    // Cleanup on scope dispose
    if (getCurrentScope()) {
        onScopeDispose(() => abort('Scope disposed'));
    }

    // Auto-tracking: when requests is a getter and lazy:false, re-execute on dep changes
    if (!lazy && typeof requests === 'function') {
        const trackingScope = effectScope();
        trackingScope.run(() => {
            const requestsComputed = computed(() =>
                (requests as () => Array<string | BatchRequestConfig>)().map(normalizeRequest)
            );
            watch(requestsComputed, () => {
                execute();
            }, { deep: true });
        });
        if (getCurrentScope()) onScopeDispose(() => trackingScope.stop());
        // Trigger initial execution for getter with auto-tracking
        execute();
    } else if (immediate) {
        // For non-getter requests, execute immediately if requested.
        // (Getter requests with lazy:false already execute on mount via auto-tracking above.)
        execute();
    }

    // Legacy watch option (deprecated — use reactive getter with lazy:false instead)
    if (watchSource) {
        watch(watchSource, () => {
            execute();
        }, { deep: true });
    }

    return {
        data,
        successfulData,
        loading,
        revalidating,
        error,
        errors,
        progress,
        execute,
        abort,
        reset,
    };
}

