import { ref, computed, effectScope, getCurrentScope, onScopeDispose, toValue, watch, type Ref, type MaybeRefOrGetter } from "vue";
import type { AxiosResponse } from "axios";
import { useApi } from "./useApi";
import { useApiConfig } from "./plugin";
import { useRefetchTriggers } from "./composables/useRefetchTriggers";
import { normalizeCacheOptions, resolveCacheKey, readCacheEntry } from "./features/cacheManager";
import { resolveClient } from "./features/clientRegistry";
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
 * All state that belongs to a single call of `execute()`.
 *
 * `results` is the run's own dense array — seeded with a pending item per
 * request and never shared with anyone. `execute()` resolves with a copy of it,
 * so `reset()` (which empties the shared `data` ref) or a replacing run can not
 * turn the returned value into a sparse array. Tallies live here too, so a
 * superseded run can not corrupt the progress of the one that replaced it.
 */
interface BatchRun<T> {
    readonly id: number;
    readonly total: number;
    readonly results: BatchResultItem<T>[];
    readonly controllers: AbortController[];
    aborted: boolean;
    succeeded: number;
    failed: number;
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

    // The run allowed to write to the shared state above. `abort()`, `reset()`
    // and a replacing `execute()` clear it — from that moment the superseded run
    // only fills its own `results` and touches nothing else.
    let activeRun: BatchRun<T> | null = null;
    let runId = 0;
    const isOwner = (run: BatchRun<T>): boolean => activeRun === run;
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
    const publishItem = (run: BatchRun<T>, item: BatchResultItem<T>) => {
        run.results[item.index] = item;
        if (isOwner(run)) data.value[item.index] = item;
    };

    /**
     * Publish an item as final: record it on the run, tally it, tick progress and
     * fire its callback. A superseded run stops at its own `results`: no writes to
     * `data`/`errors`/`progress` and no callbacks for a screen that moved on.
     * An aborted item is neither a success nor a failure — it is not tallied,
     * does not reach `errors` and does not fire `onItemError`.
     */
    const settleItem = (run: BatchRun<T>, item: BatchResultItem<T>) => {
        run.results[item.index] = item;

        const cancelled = item.status === 'aborted';
        if (item.success) {
            run.succeeded++;
        } else if (!cancelled) {
            run.failed++;
        }

        if (!isOwner(run)) return;

        data.value[item.index] = item;
        if (!item.success && !cancelled && item.error) errors.value.push(item.error);
        updateProgress(run.succeeded, run.failed, run.total);

        if (item.success) {
            onItemSuccess?.(item, item.index);
        } else if (!cancelled && item.error) {
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
    /** The client an item uses — its own, else the batch's (undefined = default). */
    const clientFor = (config: BatchRequestConfig) => config.client ?? apiOptions.client;

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
            clientFor(config),
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

        // A cancelled request is not a failed one: no error, no `errors` entry,
        // no onItemError, and it never counts towards the all-failed aggregate.
        // A cancelled revalidation keeps the cached value on screen, still stale.
        const cancelled = (): BatchResultItem<T> => ({
            ...base,
            success: false,
            status: 'aborted',
            stale: job.revalidate,
            data: job.revalidate ? job.cached : null,
            error: null,
            statusCode: null,
        });

        // Each internal useApi instance gets its own effectScope so that
        // onScopeDispose, poll timers, and event listeners are properly cleaned up
        // even when executeRequest() runs outside a Vue component's setup context.
        // An unknown item-level client would make useApi throw outside the try below
        // and leave the item looking cancelled — report it as this item's failure
        try {
            resolveClient(useApiConfig(), clientFor(config));
        } catch (err) {
            return failure({
                message: err instanceof Error ? err.message : String(err),
                status: 0,
                code: 'BATCH_ERROR',
            });
        }

        const scope = effectScope();
        const api = scope.run(() => useApi<TRaw, unknown, T>(config.url, {
            ...apiOptions,
            client: clientFor(config),
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
                return cancelled();
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
            if (signal.aborted) return cancelled();

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
        run: BatchRun<T>,
        jobs: BatchJob<T>[],
        limit: number | undefined,
    ): Promise<void> => {
        const runJob = async (job: BatchJob<T>): Promise<void> => {
            const controller = new AbortController();
            run.controllers.push(controller);
            if (run.aborted) controller.abort('Batch aborted');

            const item = await executeRequest(job, controller.signal);
            settleItem(run, item);

            // In non-settled mode, abort siblings then throw. A failed background
            // revalidation is not fatal — its item still holds usable cached data.
            // Ownership is kept here on purpose: this run still owns the error it
            // is about to surface in `error.value`.
            if (!settled && !item.success && item.error && !job.revalidate) {
                abortRun(run, 'First request failed in non-settled mode');
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
                while (currentIndex < jobs.length && !run.aborted) {
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

    /**
     * Every item still `pending` when the run is over was cancelled before it
     * could reach the network (abort with a concurrency limit, or a replaced run).
     * Recording that keeps `results` free of `pending` leftovers, so the caller can
     * always tell "cancelled" from "never answered".
     */
    const markUnresolvedAsAborted = (run: BatchRun<T>) => {
        run.results.forEach((item, index) => {
            if (item.status !== 'pending') return;
            const item_ = { ...item, status: 'aborted' as const };
            run.results[index] = item_;
            if (isOwner(run)) data.value[index] = item_;
        });
    };

    const execute = async (): Promise<BatchResultItem<T>[]> => {
        // Abort any in-flight execution before starting a new one — and disown it,
        // so its late results can not leak into the run about to start.
        if (activeRun) {
            discardActiveRun('Replaced by new execution');
        }

        const currentRequests = getRequests();
        const total = currentRequests.length;

        // Everything this run may write to before it is superseded lives here.
        const run: BatchRun<T> = {
            id: ++runId,
            total,
            results: currentRequests.map((config, index) => pendingItem(config, index)),
            controllers: [],
            aborted: false,
            succeeded: 0,
            failed: 0,
        };
        activeRun = run;

        // Reset state
        error.value = null;
        errors.value = [];

        // Seed placeholders so `data` is indexable (and of the final length) while
        // requests are still in flight — items are published as they land.
        data.value = [...run.results];
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
                settleItem(run, item);
                continue;
            }

            publishItem(run, item);
            jobs.push({ config, index, revalidate: true, cached: hit.data });
        }

        loading.value = jobs.some(job => !job.revalidate);
        revalidating.value = jobs.some(job => job.revalidate);

        try {
            await executeWithConcurrency(run, jobs, concurrency);
            markUnresolvedAsAborted(run);

            // Set the aggregated error only when every request that actually got
            // an answer failed. Cancelled items are not failures, so an abort or a
            // reset mid-flight no longer reads as "all requests failed".
            const resolved = run.results.filter(item => item.status === 'success' || item.status === 'error');
            const allFailed = resolved.length > 0 && resolved.every(item => !item.success);
            if (allFailed && isOwner(run)) {
                error.value = {
                    message: `All ${resolved.length} requests failed`,
                    status: 0,
                    code: 'BATCH_ALL_FAILED',
                };
            }

            return [...run.results];
        } catch (err) {
            markUnresolvedAsAborted(run);
            // Reached in non-settled mode when a request fails, and for any
            // unexpected internal failure — either way the error must be visible
            // in `error`, not only thrown at whoever happened to await execute().
            if (isOwner(run)) {
                error.value = settled
                    ? {
                        message: err instanceof Error ? err.message : String(err),
                        status: 0,
                        code: 'BATCH_ERROR',
                    }
                    : (err as ApiError);
            }
            throw err;
        } finally {
            // A superseded run must not touch the state of the run that replaced
            // it: no spinner reset, no onFinish, no poll tick of its own.
            if (isOwner(run)) {
                activeRun = null;
                loading.value = false;
                revalidating.value = false;
                run.controllers.length = 0;
                onFinish?.([...run.results]);
                if (!run.aborted) {
                    notifyFetched();
                    const { interval, whenHidden } = getPollConfig();
                    if (interval > 0) {
                        const hidden = typeof document !== 'undefined' && document.hidden;
                        if (whenHidden || !hidden) {
                            pollTimer = setTimeout(() => {
                                pollTimer = null;
                                // The error is already exposed via `error`/`errors`.
                                void execute().catch(() => {});
                            }, interval);
                        }
                    }
                }
            }
        }
    };

    /** Cancel a run's in-flight requests without changing who owns the state. */
    const abortRun = (run: BatchRun<T>, message: string) => {
        run.aborted = true;
        for (const controller of run.controllers) {
            controller.abort(message);
        }
        run.controllers.length = 0;
    };

    /**
     * Cancel the current run *and* disown it — used when the state it was writing
     * into no longer belongs to it: `reset()`, a replacing `execute()`, or a
     * disposed scope. From here on the run may only fill its own `results`: the
     * promise its caller holds still resolves, with everything unanswered marked
     * `aborted`, but `data`, `errors`, `progress`, `loading` and the callbacks are
     * out of its reach.
     */
    const discardActiveRun = (message: string) => {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }

        const run = activeRun;
        activeRun = null;
        loading.value = false;
        revalidating.value = false;
        if (run) abortRun(run, message);
    };

    const abort = (message = 'Batch aborted') => {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        revalidating.value = false;
        // The run stays the current one: it is cancelled, not replaced, so it
        // still gets to clear `loading` and report through `onFinish` when its
        // requests unwind. Its unanswered items land as `aborted`.
        if (activeRun) abortRun(activeRun, message);
    };

    const reset = () => {
        discardActiveRun('Batch reset');
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
        onScopeDispose(() => discardActiveRun('Scope disposed'));
    }

    // Auto-tracking: when requests is a getter and lazy:false, re-execute on dep changes
    if (!lazy && typeof requests === 'function') {
        const trackingScope = effectScope();
        trackingScope.run(() => {
            const requestsComputed = computed(() =>
                (requests as () => Array<string | BatchRequestConfig>)().map(normalizeRequest)
            );
            // Every internal trigger swallows the rejection: in non-settled mode
            // execute() rejects, but the error is already exposed via `error` /
            // `errors`, and nobody awaits these calls — an unhandled rejection here
            // would surface as a global error in the consuming app.
            watch(requestsComputed, () => {
                void execute().catch(() => {});
            }, { deep: true });
        });
        if (getCurrentScope()) onScopeDispose(() => trackingScope.stop());
        // Trigger initial execution for getter with auto-tracking
        void execute().catch(() => {});
    } else if (immediate) {
        // For non-getter requests, execute immediately if requested.
        // (Getter requests with lazy:false already execute on mount via auto-tracking above.)
        void execute().catch(() => {});
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

