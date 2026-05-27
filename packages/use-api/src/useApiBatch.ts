import { ref, computed, effectScope, getCurrentScope, onScopeDispose, toValue, watch, type Ref, type MaybeRefOrGetter } from "vue";
import type { AxiosResponse } from "axios";
import { useApi } from "./useApi";
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
 * - Watch option for auto re-execution
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
 * // Reactive getter with object configs
 * const pages = ref([1, 2, 3])
 * const { successfulData } = useApiBatch(
 *   () => pages.value.map(page => ({ url: '/users', params: { page } })),
 *   { watch: pages, immediate: true }
 * )
 * ```
 */
export function useApiBatch<T = unknown>(
    requests: MaybeRefOrGetter<Array<string | BatchRequestConfig>>,
    options: UseApiBatchOptions<T> = {},
): UseApiBatchReturn<T> {
    const {
        settled = true,
        concurrency,
        immediate = false,
        skipErrorNotification = true,
        lazy = false,
        poll = 0,
        watch: watchSource,
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

    const executeRequest = async (
        config: BatchRequestConfig,
        index: number,
        signal: AbortSignal
    ): Promise<BatchResultItem<T>> => {
        // Each internal useApi instance gets its own effectScope so that
        // onScopeDispose, poll timers, and event listeners are properly cleaned up
        // even when executeRequest() runs outside a Vue component's setup context.
        const scope = effectScope();
        const api = scope.run(() => useApi<T>(config.url, {
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
                return {
                    url: config.url,
                    index,
                    success: false,
                    data: null,
                    error: { message: 'Request aborted', status: 0, code: 'ABORTED' },
                    statusCode: null,
                    response: null,
                    request: config,
                };
            }

            const item: BatchResultItem<T> = {
                url: config.url,
                index,
                success: result !== null && result !== undefined,
                data: result ?? null,
                error: reqError.value,
                statusCode: statusCode.value,
                response: response.value as AxiosResponse<T> | null,
                request: config,
            };

            if (item.success) {
                onItemSuccess?.(item, index);
            } else if (item.error) {
                onItemError?.(item, index);
            }

            return item;
        } catch (err) {
            const apiError: ApiError = {
                message: err instanceof Error ? err.message : 'Unknown error',
                status: 0,
                code: 'BATCH_ERROR',
            };

            const item: BatchResultItem<T> = {
                url: config.url,
                index,
                success: false,
                data: null,
                error: apiError,
                statusCode: null,
                response: null,
                request: config,
            };

            onItemError?.(item, index);
            return item;
        } finally {
            scope.stop();
        }
    };

    const executeWithConcurrency = async (
        requests: BatchRequestConfig[],
        limit: number | undefined,
        total: number
    ): Promise<BatchResultItem<T>[]> => {
        const results: BatchResultItem<T>[] = new Array(requests.length);
        let succeededCount = 0;
        let failedCount = 0;

        if (!limit || limit >= requests.length) {
            // No limit - execute all in parallel
            const promises = requests.map((config, index) => {
                const controller = new AbortController();
                abortControllers.value.push(controller);

                return executeRequest(config, index, controller.signal).then(result => {
                    results[index] = result;
                    if (result.success) {
                        succeededCount++;
                    } else {
                        failedCount++;
                        if (result.error) {
                            errors.value.push(result.error);
                        }
                    }
                    updateProgress(succeededCount, failedCount, total);

                    // In non-settled mode, abort siblings then throw
                    if (!settled && !result.success && result.error) {
                        abort('First request failed in non-settled mode');
                        throw result.error;
                    }

                    return result;
                });
            });

            if (settled) {
                await Promise.allSettled(promises);
            } else {
                await Promise.all(promises);
            }
        } else {
            // With concurrency limit
            let currentIndex = 0;

            const executeNext = async (): Promise<void> => {
                while (currentIndex < requests.length && !isAborted) {
                    const index = currentIndex++;
                    const config = requests[index];

                    const controller = new AbortController();
                    abortControllers.value.push(controller);

                    const result = await executeRequest(config, index, controller.signal);
                    results[index] = result;

                    if (result.success) {
                        succeededCount++;
                    } else {
                        failedCount++;
                        if (result.error) {
                            errors.value.push(result.error);
                        }
                    }
                    updateProgress(succeededCount, failedCount, total);

                    // In non-settled mode, abort remaining on first error
                    if (!settled && !result.success && result.error) {
                        abort('First request failed in non-settled mode');
                        throw result.error;
                    }
                }
            };

            // Start `limit` workers
            const workers = Array.from({ length: Math.min(limit, requests.length) }, () => executeNext());

            if (settled) {
                await Promise.allSettled(workers);
            } else {
                await Promise.all(workers);
            }
        }

        return results;
    };

    const execute = async (): Promise<BatchResultItem<T>[]> => {
        // Abort any in-flight execution before starting a new one
        if (loading.value) {
            abort('Replaced by new execution');
        }

        const currentRequests = getRequests();

        // Reset state
        isAborted = false;
        loading.value = true;
        error.value = null;
        errors.value = [];
        data.value = [];
        abortControllers.value = [];
        const total = currentRequests.length;
        updateProgress(0, 0, total);

        let finalResults: BatchResultItem<T>[] = [];
        try {
            finalResults = await executeWithConcurrency(currentRequests, concurrency, total);
            data.value = finalResults;

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
            abortControllers.value = [];
            onFinish?.(finalResults);
        }
    };

    const abort = (message = 'Batch aborted') => {
        isAborted = true;
        for (const controller of abortControllers.value) {
            controller.abort(message);
        }
        abortControllers.value = [];
    };

    const reset = () => {
        abort();
        loading.value = false;
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
        // Trigger initial execution
        execute();
    }

    // Legacy watch option (deprecated — use reactive getter with lazy:false instead)
    if (watchSource) {
        watch(watchSource, () => {
            execute();
        }, { deep: true });
    }

    // Execute immediately if requested
    if (immediate) {
        execute();
    }

    return {
        data,
        successfulData,
        loading,
        error,
        errors,
        progress,
        execute,
        abort,
        reset,
    };
}

