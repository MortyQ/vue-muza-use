# useApiBatch Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four correctness bugs in `useApiBatch`, add two perf fixes, introduce `lazy`/auto-tracking and `poll` options, and deprecate the `watch` option.

**Architecture:** All changes are confined to three files: `useApiBatch.ts` (logic), `useApi.ts` (one signal-chain fix), and `types.ts` (new option types). Each task is an independent commit, tested in isolation before the next starts.

**Tech Stack:** Vue 3, TypeScript, Axios, Vitest

---

## File Map

| File | Role in this change |
|---|---|
| `packages/use-api/src/useApiBatch.ts` | All batch logic changes (race fix, settled fix, onFinish, perf, lazy, poll, @deprecated) |
| `packages/use-api/src/useApi.ts` | External signal chain (one new if-block, ~5 lines) |
| `packages/use-api/src/types.ts` | Add `lazy`, `poll` to `UseApiBatchOptions`; deprecate `watch` |
| `packages/use-api/src/useApiBatch.test.ts` | New test cases (appended to existing file) |

---

## Task 1: Fix external signal chain in useApi.ts

The `executeRequest` in `useApiBatch` passes `{ signal }` to `useApi`'s `execute()`. Inside `useApi`, `axios.request()` always uses `{ signal: controller.signal }` (the *internal* controller), overwriting the incoming signal. Abort calls on the batch controller never reach Axios. Fix: chain the external signal to the internal controller via a one-time listener.

**Files:**
- Modify: `packages/use-api/src/useApi.ts:154-155`
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Write the failing test**

Append this describe block to the end of `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Task 1: external signal chain — abort() reaches Axios
// ---------------------------------------------------------------------------

describe('useApiBatch — abort() cancels in-flight Axios requests', () => {
  it('abort() causes in-flight requests to be cancelled at the Axios level', async () => {
    let capturedSignal: AbortSignal | undefined

    mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
      capturedSignal = config.signal
      // Return a promise that never resolves — simulates a long-running request
      return new Promise(() => {})
    })

    const { execute, abort } = useApiBatch(['/slow'])
    const p = execute()
    // Give execute() time to reach mockRequest
    await new Promise(r => setTimeout(r, 0))

    expect(capturedSignal).toBeDefined()
    expect(capturedSignal!.aborted).toBe(false)

    abort('test abort')

    expect(capturedSignal!.aborted).toBe(true)

    // Prevent unhandled rejection from the never-resolving promise
    await p.catch(() => {})
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: FAIL — `expect(capturedSignal!.aborted).toBe(true)` fails (signal is still `false` after abort).

- [ ] **Step 3: Apply the fix in useApi.ts**

In `packages/use-api/src/useApi.ts`, find these two consecutive lines (around line 154):

```ts
        const controller = new AbortController();
        abortController.value = controller;
```

Add the signal chain immediately after:

```ts
        const controller = new AbortController();
        abortController.value = controller;

        // Chain external signal → internal controller so batch abort reaches Axios
        if (config?.signal && !config.signal.aborted) {
            config.signal.addEventListener('abort', () => {
                controller.abort(config.signal!.reason);
            }, { once: true });
        }
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS including the new abort test.

- [ ] **Step 5: Commit**

```bash
git add packages/use-api/src/useApi.ts packages/use-api/src/useApiBatch.test.ts
git commit -m "fix: chain external signal to internal AbortController in useApi"
```

---

## Task 2: Fix race condition in execute()

When `execute()` is called while a previous batch is still running, `abortControllers.value = []` at the top of the new run clears the list without calling `.abort()` on the old controllers. The old requests keep running, finish later, and overwrite `data` with stale results.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.ts:286-296`
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Task 2: race condition — rapid re-execute aborts the previous run
// ---------------------------------------------------------------------------

describe('useApiBatch — race condition', () => {
  it('second execute() aborts the first before starting', async () => {
    const signals: AbortSignal[] = []
    let resolveFirst!: (v: unknown) => void

    mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
      if (config.signal) signals.push(config.signal)
      if (signals.length === 1) {
        // First call: never resolves until we manually resolve it
        return new Promise(r => { resolveFirst = r })
      }
      return Promise.resolve({ data: { run: 2 }, status: 200 })
    })

    const { execute, data } = useApiBatch(['/a'])

    // Start first execution — will hang
    const p1 = execute()
    await new Promise(r => setTimeout(r, 0)) // let mockRequest be called

    // Start second execution immediately — should abort first
    const p2 = execute()
    await p2

    // First signal should be aborted
    expect(signals[0]?.aborted).toBe(true)
    // Second execution's data should win
    expect(data.value[0]?.data).toEqual({ run: 2 })

    // Resolve p1 to avoid dangling promise
    resolveFirst({ data: {}, status: 200 })
    await p1.catch(() => {})
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: FAIL — `signals[0]?.aborted` is `false`.

- [ ] **Step 3: Apply the fix in useApiBatch.ts**

In `packages/use-api/src/useApiBatch.ts`, find the `execute` function (around line 286). It currently starts with:

```ts
    const execute = async (): Promise<BatchResultItem<T>[]> => {
        const currentRequests = getRequests();

        // Reset state
        isAborted = false;
```

Add the abort-on-overlap guard **before** the reset block:

```ts
    const execute = async (): Promise<BatchResultItem<T>[]> => {
        // Abort any in-flight execution before starting a new one
        if (loading.value) {
            abort('Replaced by new execution');
        }

        const currentRequests = getRequests();

        // Reset state
        isAborted = false;
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/use-api/src/useApiBatch.ts packages/use-api/src/useApiBatch.test.ts
git commit -m "fix: abort in-flight batch before starting a new execute() call"
```

---

## Task 3: Fix settled:false (unlimited-concurrency missing abort) + onFinish in finally

Two related bugs in the execute flow:

**Bug A:** When `settled: false` and there is no concurrency limit, the `.then()` callback throws on failure but never calls `abort()`. Sibling requests continue running.

**Bug B:** `onFinish` is called inside the `try` block. When `settled: false` rejects, `onFinish` never fires.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.ts`
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Task 3A: settled:false unlimited-concurrency — abort remaining on first failure
// ---------------------------------------------------------------------------

describe('useApiBatch — settled:false aborts siblings', () => {
  it('settled:false aborts remaining in-flight requests when one fails', async () => {
    const signals: AbortSignal[] = []

    mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
      if (config.signal) signals.push(config.signal)
      // All requests hang until their signal is aborted or we manually settle
      return new Promise((resolve, reject) => {
        config.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        // The first request resolves after a microtask to let all requests register
        if (signals.length === 1) {
          Promise.resolve().then(() => {
            const err = Object.assign(new Error('Server error'), {
              isAxiosError: true,
              response: { status: 500, data: { message: 'Server error' } },
            })
            reject(err)
          })
        }
      })
    })

    const { execute } = useApiBatch(['/a', '/b', '/c'], { settled: false })
    await execute().catch(() => {})

    // All signals should be aborted (including siblings of the failed request)
    expect(signals.every(s => s.aborted)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Task 3B: onFinish fires even when settled:false rejects
// ---------------------------------------------------------------------------

describe('useApiBatch — onFinish always fires', () => {
  it('onFinish is called even when settled:false batch rejects', async () => {
    mockRequest
      .mockRejectedValueOnce(Object.assign(new Error('fail'), {
        isAxiosError: true,
        response: { status: 500, data: { message: 'fail' } },
      }))

    const onFinish = vi.fn()
    const { execute } = useApiBatch(['/fail'], { settled: false, onFinish })
    await execute().catch(() => {})

    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('onFinish receives partial results when settled:false rejects mid-batch', async () => {
    let callCount = 0
    mockRequest.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve({ data: { id: 1 }, status: 200 })
      return Promise.reject(Object.assign(new Error('fail'), {
        isAxiosError: true,
        response: { status: 500, data: { message: 'fail' } },
      }))
    })

    const onFinish = vi.fn()
    const { execute } = useApiBatch(['/a', '/b'], { settled: false, onFinish })
    await execute().catch(() => {})

    expect(onFinish).toHaveBeenCalledOnce()
    // Results array may be partial — but it must be an array
    const [results] = onFinish.mock.calls[0]
    expect(Array.isArray(results)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: FAIL — `signals.every(s => s.aborted)` fails and `onFinish` call count is 0.

- [ ] **Step 3: Fix Bug A — add abort() in the unlimited-concurrency path**

In `packages/use-api/src/useApiBatch.ts`, find the unlimited-concurrency `!settled` throw inside the `.then()` chain (around line 227):

```ts
                    // In non-settled mode, throw on first error
                    if (!settled && !result.success && result.error) {
                        throw result.error;
                    }
```

Replace with:

```ts
                    // In non-settled mode, abort siblings then throw
                    if (!settled && !result.success && result.error) {
                        abort('First request failed in non-settled mode');
                        throw result.error;
                    }
```

- [ ] **Step 4: Fix Bug B — move onFinish to finally**

In `packages/use-api/src/useApiBatch.ts`, find the `execute` function's `try/catch/finally` block (starting around line 298). Currently:

```ts
        try {
            const results = await executeWithConcurrency(currentRequests, concurrency);
            data.value = results;

            // Set aggregated error if all requests failed
            const allFailed = results.every(r => !r.success);
            if (allFailed && results.length > 0) {
                error.value = {
                    message: `All ${results.length} requests failed`,
                    status: 0,
                    code: 'BATCH_ALL_FAILED',
                };
            }

            onFinish?.(results);
            return results;
        } catch (err) {
            // This happens in non-settled mode when first request fails
            if (!settled) {
                error.value = err as ApiError;
            }
            throw err;
        } finally {
            loading.value = false;
            abortControllers.value = [];
        }
```

Replace with:

```ts
        let finalResults: BatchResultItem<T>[] = [];
        try {
            finalResults = await executeWithConcurrency(currentRequests, concurrency);
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
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/use-api/src/useApiBatch.ts packages/use-api/src/useApiBatch.test.ts
git commit -m "fix: abort siblings on settled:false failure; always call onFinish in finally"
```

---

## Task 4: Perf — lazy:true on internal useApi call + cache progress.total

Two internal improvements with no behavioral change to existing tests:

**Perf A:** The `useApi` instance inside `executeRequest` has `lazy` unset, so it initializes reactive tracking for `url`, `params`, and `data`. Batch items are fire-once — this tracking is wasted. Setting `lazy: true` removes it.

**Perf B:** `updateProgress` calls `getRequests()` (which runs `toValue(requests).map(normalizeRequest)`) on every progress tick — O(n) per completed item, O(n²) total. Compute `total` once per `execute()` call and thread it in.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.ts`

- [ ] **Step 1: Update updateProgress signature to accept total**

In `packages/use-api/src/useApiBatch.ts`, find `updateProgress` (around line 106):

```ts
    const updateProgress = (succeeded: number, failed: number) => {
        const currentRequests = getRequests();
        const completed = succeeded + failed;
        const newProgress: BatchProgress = {
            completed,
            total: currentRequests.length,
            percentage: currentRequests.length > 0 ? Math.round((completed / currentRequests.length) * 100) : 0,
            succeeded,
            failed,
        };
        progress.value = newProgress;
        onProgress?.(newProgress);
    };
```

Replace with:

```ts
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
```

- [ ] **Step 2: Update executeWithConcurrency to accept and thread total**

Find `executeWithConcurrency` signature (around line 200):

```ts
    const executeWithConcurrency = async (
        requests: BatchRequestConfig[],
        limit?: number
    ): Promise<BatchResultItem<T>[]> => {
```

Replace with:

```ts
    const executeWithConcurrency = async (
        requests: BatchRequestConfig[],
        limit: number | undefined,
        total: number
    ): Promise<BatchResultItem<T>[]> => {
```

Then find all four `updateProgress(succeededCount, failedCount)` calls inside `executeWithConcurrency` and replace each with `updateProgress(succeededCount, failedCount, total)`.

- [ ] **Step 3: Update the initial progress call in execute() and the executeWithConcurrency call**

In the `execute()` function body, find:

```ts
        const currentRequests = getRequests();

        // Reset state
        isAborted = false;
        ...
        updateProgress(0, 0);
```

Replace `updateProgress(0, 0)` with:

```ts
        const total = currentRequests.length;
        updateProgress(0, 0, total);
```

Then find the `executeWithConcurrency` call in `execute()`:

```ts
            finalResults = await executeWithConcurrency(currentRequests, concurrency);
```

Replace with:

```ts
            finalResults = await executeWithConcurrency(currentRequests, concurrency, total);
```

- [ ] **Step 4: Add lazy:true to the internal useApi call in executeRequest**

Find in `executeRequest` (around line 129):

```ts
        const api = scope.run(() => useApi<T>(config.url, {
            ...apiOptions,
            method: config.method,
            data: config.data,
            params: config.params,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(config.headers && { headers: config.headers as any }),
            useGlobalAbort: false,
            skipErrorNotification,
        }))!;
```

Replace with:

```ts
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
```

- [ ] **Step 5: Run all tests and verify nothing broke**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/use-api/src/useApiBatch.ts
git commit -m "perf: cache progress.total per execution; set lazy:true on internal useApi calls"
```

---

## Task 5: Types — add lazy, poll; deprecate watch in UseApiBatchOptions

**Files:**
- Modify: `packages/use-api/src/types.ts`

- [ ] **Step 1: Update UseApiBatchOptions in types.ts**

Find `UseApiBatchOptions` in `packages/use-api/src/types.ts` (around line 335). Currently:

```ts
export interface UseApiBatchOptions<T = unknown, D = unknown> extends Omit<ApiRequestConfig<D>, "url"> {
    /**
     * If true (default), failed requests don't stop the batch.
     * If false, first error will reject the entire batch.
     */
    settled?: boolean;
    /** Maximum concurrent requests. Default: unlimited */
    concurrency?: number;
    /** Execute immediately on mount */
    immediate?: boolean;
    /** Skip individual error notifications */
    skipErrorNotification?: boolean;
    /** Watch sources to trigger re-execution */
    watch?: WatchSource | WatchSource[];
    /** Callback when a single request succeeds */
    onItemSuccess?: (item: BatchResultItem<T>, index: number) => void;
    /** Callback when a single request fails */
    onItemError?: (item: BatchResultItem<T>, index: number) => void;
    /** Callback when all requests complete */
    onFinish?: (results: BatchResultItem<T>[]) => void;
    /** Callback when progress updates */
    onProgress?: (progress: BatchProgress) => void;
}
```

Replace with:

```ts
export interface UseApiBatchOptions<T = unknown, D = unknown> extends Omit<ApiRequestConfig<D>, "url"> {
    /**
     * If true (default), failed requests don't stop the batch.
     * If false, first error will reject the entire batch.
     */
    settled?: boolean;
    /** Maximum concurrent requests. Default: unlimited */
    concurrency?: number;
    /** Execute immediately on mount */
    immediate?: boolean;
    /** Skip individual error notifications */
    skipErrorNotification?: boolean;
    /**
     * Disable auto-tracking. When true, reactive changes to the `requests` getter
     * will NOT trigger re-execution. Use when you want full manual control via execute().
     * Default: false — auto-tracks when `requests` is a function.
     */
    lazy?: boolean;
    /**
     * Polling interval in ms, or advanced config object.
     * - Pass a number: `poll: 5000` — re-execute every 5 seconds.
     * - Pass an object: `poll: { interval: 5000, whenHidden: false }` — skip polling when tab is hidden.
     * Properties inside the object can also be Refs.
     */
    poll?: MaybeRefOrGetter<number | {
        interval: MaybeRefOrGetter<number>;
        whenHidden?: MaybeRefOrGetter<boolean>;
    }>;
    /**
     * @deprecated Use a reactive getter for `requests` with `lazy: false` (default).
     * Auto-tracking will re-execute when the getter's dependencies change.
     * Will be removed in v2.0.
     *
     * @example
     * // Before (deprecated):
     * useApiBatch(() => ids.value.map(id => `/items/${id}`), { watch: ids })
     *
     * // After (preferred):
     * useApiBatch(() => ids.value.map(id => `/items/${id}`))
     */
    watch?: WatchSource | WatchSource[];
    /** Callback when a single request succeeds */
    onItemSuccess?: (item: BatchResultItem<T>, index: number) => void;
    /** Callback when a single request fails */
    onItemError?: (item: BatchResultItem<T>, index: number) => void;
    /** Callback when all requests complete */
    onFinish?: (results: BatchResultItem<T>[]) => void;
    /** Callback when progress updates */
    onProgress?: (progress: BatchProgress) => void;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /path/to/repo/packages/use-api && pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/types.ts
git commit -m "types: add lazy and poll to UseApiBatchOptions; deprecate watch"
```

---

## Task 6: Feature — lazy option + auto-tracking

When `lazy: false` (default) and `requests` is a function, wrap it in a `computed`, watch it for deep changes, and call `execute()` automatically. This removes the need for a separate `watch` option.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.ts`
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Task 6: lazy option + auto-tracking
// ---------------------------------------------------------------------------

describe('useApiBatch — lazy / auto-tracking', () => {
  it('lazy:false (default) — changing a reactive dep in the getter triggers execute()', async () => {
    const { ref, nextTick } = await import('vue')
    const ids = ref([1, 2])

    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    const { data } = useApiBatch(
      () => ids.value.map(id => ({ url: `/items/${id}` }))
    )

    // Wait for initial auto-execute
    await nextTick()
    await nextTick()

    expect(mockRequest).toHaveBeenCalledTimes(2)

    // Change the reactive dep
    ids.value = [1, 2, 3]
    await nextTick()
    await nextTick()

    // Should have fired again with 3 requests
    expect(mockRequest).toHaveBeenCalledTimes(5) // 2 + 3
    expect(data.value).toHaveLength(3)
  })

  it('lazy:false (default) — static array does NOT auto-execute', async () => {
    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    const { nextTick } = await import('vue')
    useApiBatch(['/a', '/b'])
    await nextTick()
    await nextTick()

    // Static array: no auto-tracking, no automatic execute
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('lazy:true — changing a reactive dep does NOT trigger execute()', async () => {
    const { ref, nextTick } = await import('vue')
    const ids = ref([1, 2])

    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    useApiBatch(
      () => ids.value.map(id => ({ url: `/items/${id}` })),
      { lazy: true }
    )

    ids.value = [1, 2, 3]
    await nextTick()
    await nextTick()

    // lazy:true disables auto-tracking — no requests fired
    expect(mockRequest).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: FAIL — the auto-tracking tests find `mockRequest` not called / called wrong number of times.

- [ ] **Step 3: Update the options destructuring in useApiBatch**

In `packages/use-api/src/useApiBatch.ts`, find the destructuring at the top of the composable body (around line 66):

```ts
    const {
        settled = true,
        concurrency,
        immediate = false,
        skipErrorNotification = true,
        watch: watchSource,
        onItemSuccess,
        onItemError,
        onFinish,
        onProgress,
        ...apiOptions
    } = options;
```

Replace with:

```ts
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
```

- [ ] **Step 4: Add the auto-tracking block**

In `packages/use-api/src/useApiBatch.ts`, find the existing `watchSource` block and the `immediate` block near the bottom of the composable body (around line 354):

```ts
    // Watch for changes and re-execute
    if (watchSource) {
        watch(watchSource, () => {
            execute();
        }, { deep: true });
    }

    // Execute immediately if requested
    if (immediate) {
        execute();
    }
```

Replace with:

```ts
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
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/use-api/src/useApiBatch.ts packages/use-api/src/useApiBatch.test.ts
git commit -m "feat: add lazy option and auto-tracking to useApiBatch"
```

---

## Task 7: Feature — poll option for batch

After `execute()` completes, if `poll.interval > 0` and the batch was not aborted, schedule `setTimeout → execute()`. Skip scheduling if `whenHidden: false` (default) and the tab is hidden. `abort()` must clear the poll timer.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.ts`
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Task 7: poll option
// ---------------------------------------------------------------------------

describe('useApiBatch — poll', () => {
  it('poll:N re-executes after N ms', async () => {
    vi.useFakeTimers()
    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    const { execute } = useApiBatch(['/a'], { poll: 100 })
    await execute()

    expect(mockRequest).toHaveBeenCalledTimes(1)

    // Advance timer — should trigger another execute
    await vi.advanceTimersByTimeAsync(100)

    expect(mockRequest).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('abort() clears the poll timer — no re-execution after abort', async () => {
    vi.useFakeTimers()
    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    const { execute, abort } = useApiBatch(['/a'], { poll: 100 })
    await execute()

    expect(mockRequest).toHaveBeenCalledTimes(1)
    abort()

    await vi.advanceTimersByTimeAsync(200)

    // Timer was cleared by abort — no second call
    expect(mockRequest).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('poll with whenHidden:false does not re-execute when document is hidden', async () => {
    vi.useFakeTimers()
    mockRequest.mockResolvedValue({ data: {}, status: 200 })

    // Simulate hidden tab
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })

    const { execute } = useApiBatch(['/a'], { poll: { interval: 100, whenHidden: false } })
    await execute()

    expect(mockRequest).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)

    // Tab is hidden + whenHidden:false → no re-execution
    expect(mockRequest).toHaveBeenCalledTimes(1)

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: FAIL — re-execution count wrong, timer not cleared after abort.

- [ ] **Step 3: Add pollTimer variable and getPollConfig helper**

In `packages/use-api/src/useApiBatch.ts`, after the `isAborted` variable declaration (around line 104):

```ts
    const abortControllers = ref<AbortController[]>([]);
    let isAborted = false;
```

Replace with:

```ts
    const abortControllers = ref<AbortController[]>([]);
    let isAborted = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const getPollConfig = (): { interval: number; whenHidden: boolean } => {
        const val = toValue(poll);
        if (typeof val === 'number') return { interval: val, whenHidden: false };
        return {
            interval: toValue((val as { interval: MaybeRefOrGetter<number> }).interval),
            whenHidden: toValue((val as { whenHidden?: MaybeRefOrGetter<boolean> }).whenHidden) ?? false,
        };
    };
```

- [ ] **Step 4: Schedule poll in the execute() finally block**

In `packages/use-api/src/useApiBatch.ts`, find the `finally` block in `execute()` (updated in Task 3):

```ts
        } finally {
            loading.value = false;
            abortControllers.value = [];
            onFinish?.(finalResults);
        }
```

Replace with:

```ts
        } finally {
            loading.value = false;
            abortControllers.value = [];
            onFinish?.(finalResults);
            if (!isAborted) {
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
```

- [ ] **Step 5: Clear pollTimer in abort()**

Find the `abort` function (around line 326):

```ts
    const abort = (message = 'Batch aborted') => {
        isAborted = true;
        for (const controller of abortControllers.value) {
            controller.abort(message);
        }
        abortControllers.value = [];
    };
```

Replace with:

```ts
    const abort = (message = 'Batch aborted') => {
        isAborted = true;
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
        for (const controller of abortControllers.value) {
            controller.abort(message);
        }
        abortControllers.value = [];
    };
```

- [ ] **Step 6: Run the tests and verify they pass**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests PASS.

- [ ] **Step 7: Run the full test suite to confirm no regressions**

```bash
cd /path/to/repo/packages/use-api && pnpm test -- --run
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/use-api/src/useApiBatch.ts packages/use-api/src/useApiBatch.test.ts
git commit -m "feat: add poll option to useApiBatch"
```

---

## Post-Implementation Checklist

- [ ] All existing tests still pass: `cd packages/use-api && pnpm test -- --run`
- [ ] TypeScript build succeeds: `cd packages/use-api && pnpm build`
- [ ] The `it.todo('abort() sends AbortController.abort() to in-flight axios requests ...')` in the existing test file can be promoted to a real test (covered by Task 1)
- [ ] The `it.todo('rapid re-execution ...')` can be promoted (covered by Task 2)
