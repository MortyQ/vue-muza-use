# useApiBatch Test Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the test coverage gap in `useApiBatch` to match `useApi`'s level — covering error state, onProgress, callback parameters, immediate/watch options, concurrency edge cases, poll variants, and abort/reset robustness.

**Architecture:** All changes are pure test additions appended to `packages/use-api/src/useApiBatch.test.ts`. No implementation code changes. Tests verify existing behavior — they must PASS immediately. A failing test means a discovered bug, not a missing implementation.

**Tech Stack:** Vue 3, TypeScript, Vitest, `vi.fn()`, `vi.waitFor()`, `vi.useFakeTimers()`

---

## File Map

| File | Role |
|---|---|
| `packages/use-api/src/useApiBatch.test.ts` | All new tests appended (currently ~897 lines) |

---

## Shared context for all tasks

The test file uses these shared fixtures (already in the file, do not re-declare):

```ts
const mockRequest = vi.fn()
// createApi called in beforeEach — clears between tests via vi.clearAllMocks()

function axiosError(status: number, message = 'Error') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    })
}
```

Run tests: `cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch`

---

## Task 1: Aggregated error state + errors array structure + empty array

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

Add to the end of `packages/use-api/src/useApiBatch.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Coverage: aggregated error state
// ---------------------------------------------------------------------------

describe('useApiBatch — aggregated error state', () => {
    it('error.value is set with code BATCH_ALL_FAILED when every request fails', async () => {
        mockRequest
            .mockRejectedValueOnce(axiosError(500))
            .mockRejectedValueOnce(axiosError(404))

        const { error, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(error.value).not.toBeNull()
        expect(error.value?.code).toBe('BATCH_ALL_FAILED')
        expect(error.value?.message).toContain('2')
        expect(error.value?.status).toBe(0)
    })

    it('error.value is null when only some requests fail', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const { error, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(error.value).toBeNull()
    })

    it('error.value is null after reset()', async () => {
        mockRequest
            .mockRejectedValueOnce(axiosError(500))

        const { error, execute, reset } = useApiBatch(['/a'])
        await execute()

        expect(error.value).not.toBeNull()
        reset()
        expect(error.value).toBeNull()
    })
})

describe('useApiBatch — errors array structure', () => {
    it('errors array items have message and status fields', async () => {
        mockRequest.mockRejectedValueOnce(axiosError(422, 'Validation failed'))

        const { errors, execute } = useApiBatch(['/a'])
        await execute()

        expect(errors.value).toHaveLength(1)
        expect(typeof errors.value[0].message).toBe('string')
        expect(typeof errors.value[0].status).toBe('number')
    })

    it('errors array is empty when all requests succeed', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockResolvedValueOnce({ data: {}, status: 200 })

        const { errors, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(errors.value).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// Coverage: empty request array edge case
// ---------------------------------------------------------------------------

describe('useApiBatch — empty request array', () => {
    it('empty array completes immediately with no requests fired', async () => {
        const { data, errors, loading, execute } = useApiBatch([])
        await execute()

        expect(mockRequest).not.toHaveBeenCalled()
        expect(data.value).toHaveLength(0)
        expect(errors.value).toHaveLength(0)
        expect(loading.value).toBe(false)
    })

    it('empty array progress reflects total: 0 and percentage: 0', async () => {
        const { progress, execute } = useApiBatch([])
        await execute()

        expect(progress.value.total).toBe(0)
        expect(progress.value.completed).toBe(0)
        expect(progress.value.percentage).toBe(0)
    })

    it('error.value is null for empty array — no BATCH_ALL_FAILED', async () => {
        const { error, execute } = useApiBatch([])
        await execute()

        expect(error.value).toBeNull()
    })

    it('onFinish fires with empty array for empty request batch', async () => {
        const onFinish = vi.fn()
        const { execute } = useApiBatch([], { onFinish })
        await execute()

        expect(onFinish).toHaveBeenCalledOnce()
        const [results] = onFinish.mock.calls[0]
        expect(results).toHaveLength(0)
    })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All new tests PASS. If any fail, investigate — it means a bug in the implementation, not in the tests.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: cover aggregated error state, errors array structure, empty array"
```

---

## Task 2: onProgress callback coverage

`onProgress` fires inside `updateProgress()` on every tick. It starts with `updateProgress(0, 0, total)` at the top of `execute()`, then once per completed item. The callback receives a `BatchProgress` object: `{ completed, total, percentage, succeeded, failed }`.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

```ts
// ---------------------------------------------------------------------------
// Coverage: onProgress callback
// ---------------------------------------------------------------------------

describe('useApiBatch — onProgress callback', () => {
    it('onProgress is called at least once per item after completion', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockResolvedValueOnce({ data: {}, status: 200 })

        const onProgress = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onProgress })
        await execute()

        // At minimum once per item (plus the initial 0-progress call)
        expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('onProgress final call has percentage: 100 after all complete', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockResolvedValueOnce({ data: {}, status: 200 })

        const onProgress = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onProgress })
        await execute()

        const lastCall = onProgress.mock.calls.at(-1)?.[0]
        expect(lastCall).toMatchObject({
            completed: 2,
            total: 2,
            percentage: 100,
            succeeded: 2,
            failed: 0,
        })
    })

    it('onProgress BatchProgress object contains all required fields', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const onProgress = vi.fn()
        const { execute } = useApiBatch(['/a'], { onProgress })
        await execute()

        const anyCall = onProgress.mock.calls[0][0]
        expect(anyCall).toHaveProperty('completed')
        expect(anyCall).toHaveProperty('total')
        expect(anyCall).toHaveProperty('percentage')
        expect(anyCall).toHaveProperty('succeeded')
        expect(anyCall).toHaveProperty('failed')
    })

    it('onProgress tracks failed counts correctly in final call', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const onProgress = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onProgress })
        await execute()

        const lastCall = onProgress.mock.calls.at(-1)?.[0]
        expect(lastCall).toMatchObject({
            succeeded: 1,
            failed: 1,
            total: 2,
            percentage: 100,
        })
    })

    it('progress ref reflects same values as onProgress final call', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const onProgress = vi.fn()
        const { execute, progress } = useApiBatch(['/a', '/b'], { onProgress })
        await execute()

        const lastCallArg = onProgress.mock.calls.at(-1)?.[0]
        expect(progress.value).toEqual(lastCallArg)
    })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All new tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: cover onProgress callback — fields, counts, final state"
```

---

## Task 3: Callback parameter verification + onFinish after abort

Verify that `onItemSuccess` and `onItemError` receive `(item: BatchResultItem, index: number)` with correct values, and that `onFinish` fires after a manual `abort()`.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

```ts
// ---------------------------------------------------------------------------
// Coverage: callback parameter verification
// ---------------------------------------------------------------------------

describe('useApiBatch — callback parameter verification', () => {
    it('onItemSuccess receives item with correct shape at correct index', async () => {
        mockRequest.mockResolvedValueOnce({ data: { id: 99 }, status: 200 })

        const onItemSuccess = vi.fn()
        const { execute } = useApiBatch(['/users/99'], { onItemSuccess })
        await execute()

        expect(onItemSuccess).toHaveBeenCalledOnce()
        const [item, index] = onItemSuccess.mock.calls[0]
        expect(index).toBe(0)
        expect(item).toMatchObject({
            url: '/users/99',
            success: true,
            index: 0,
            data: { id: 99 },
            error: null,
        })
    })

    it('onItemError receives item with correct shape at correct index', async () => {
        mockRequest.mockRejectedValueOnce(axiosError(404, 'Not found'))

        const onItemError = vi.fn()
        const { execute } = useApiBatch(['/missing'], { onItemError })
        await execute()

        expect(onItemError).toHaveBeenCalledOnce()
        const [item, index] = onItemError.mock.calls[0]
        expect(index).toBe(0)
        expect(item).toMatchObject({
            url: '/missing',
            success: false,
            index: 0,
            data: null,
        })
        expect(item.error).not.toBeNull()
    })

    it('onItemSuccess and onItemError receive correct indices across a mixed batch', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: 'ok', status: 200 })
            .mockRejectedValueOnce(axiosError(500))
            .mockResolvedValueOnce({ data: 'ok', status: 200 })

        const successIndices: number[] = []
        const errorIndices: number[] = []

        const { execute } = useApiBatch(['/a', '/b', '/c'], {
            onItemSuccess: (_item, i) => successIndices.push(i),
            onItemError: (_item, i) => errorIndices.push(i),
        })
        await execute()

        expect(successIndices.sort((a, b) => a - b)).toEqual([0, 2])
        expect(errorIndices).toEqual([1])
    })

    it('onFinish fires after abort() with the results accumulated before abort', async () => {
        mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
            return new Promise((_, reject) => {
                config.signal?.addEventListener('abort', () =>
                    reject(Object.assign(new Error('canceled'), {
                        isAxiosError: true,
                        code: 'ERR_CANCELED',
                        response: null,
                    }))
                )
            })
        })

        const onFinish = vi.fn()
        const { execute, abort } = useApiBatch(['/a'], { onFinish })

        const p = execute()
        await new Promise(r => setTimeout(r, 0))
        abort()
        await p.catch(() => {})

        expect(onFinish).toHaveBeenCalledOnce()
        const [results] = onFinish.mock.calls[0]
        expect(Array.isArray(results)).toBe(true)
    })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All new tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: verify onItemSuccess/Error parameters, onFinish after abort"
```

---

## Task 4: immediate option variants + deprecated watch option

`immediate: true` with a static array should auto-execute once. The deprecated `watch` option should still re-execute when the source changes.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

```ts
// ---------------------------------------------------------------------------
// Coverage: immediate option
// ---------------------------------------------------------------------------

describe('useApiBatch — immediate option', () => {
    it('immediate:true with static array executes once automatically', async () => {
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { data } = useApiBatch(['/a', '/b'], { immediate: true })

        await vi.waitFor(() => expect(data.value).toHaveLength(2))
        expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('immediate:false (default) with static array does not auto-execute', async () => {
        const { nextTick } = await import('vue')
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        useApiBatch(['/a', '/b'])
        await nextTick()
        await nextTick()

        expect(mockRequest).not.toHaveBeenCalled()
    })

    it('immediate:true executes once only — not on every render', async () => {
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { data } = useApiBatch(['/a'], { immediate: true })

        await vi.waitFor(() => expect(data.value).toHaveLength(1))
        // Should be exactly 1 — not 2, not 3
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })
})

// ---------------------------------------------------------------------------
// Coverage: deprecated watch option
// ---------------------------------------------------------------------------

describe('useApiBatch — watch option (deprecated, still functional)', () => {
    it('watch:ref re-executes when the ref changes', async () => {
        const { ref, nextTick } = await import('vue')
        const trigger = ref(0)
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { execute } = useApiBatch(['/a'], { watch: trigger })
        await execute()

        expect(mockRequest).toHaveBeenCalledTimes(1)

        trigger.value++
        await nextTick()

        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))
    })

    it('watch:[ref, ref] re-executes when any source changes', async () => {
        const { ref, nextTick } = await import('vue')
        const a = ref(0)
        const b = ref(0)
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { execute } = useApiBatch(['/a'], { watch: [a, b] })
        await execute()

        expect(mockRequest).toHaveBeenCalledTimes(1)

        b.value++
        await nextTick()

        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))
    })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All new tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: cover immediate option and deprecated watch option"
```

---

## Task 5: settled:false error details + concurrency edge cases

Verify the `error.value` content in non-settled mode and cover concurrency behavior at the boundaries.

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

```ts
// ---------------------------------------------------------------------------
// Coverage: settled:false error details
// ---------------------------------------------------------------------------

describe('useApiBatch — settled:false error details', () => {
    it('settled:false sets error.value to a non-null ApiError after rejection', async () => {
        mockRequest.mockRejectedValueOnce(axiosError(503, 'Service Unavailable'))

        const { error, execute } = useApiBatch(['/a'], { settled: false })
        await execute().catch(() => {})

        expect(error.value).not.toBeNull()
        expect(error.value?.message).toBeDefined()
        expect(typeof error.value?.message).toBe('string')
    })

    it('settled:true — error.value is null when only some requests fail', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const { error, execute } = useApiBatch(['/a', '/b'], { settled: true })
        await execute()

        expect(error.value).toBeNull()
    })

    it('settled:false — loading returns to false even after rejection', async () => {
        mockRequest.mockRejectedValueOnce(axiosError(500))

        const { loading, execute } = useApiBatch(['/a'], { settled: false })
        await execute().catch(() => {})

        expect(loading.value).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Coverage: concurrency edge cases
// ---------------------------------------------------------------------------

describe('useApiBatch — concurrency edge cases', () => {
    it('concurrency larger than total requests runs all in parallel', async () => {
        let peak = 0
        let active = 0

        mockRequest.mockImplementation(() => {
            active++
            peak = Math.max(peak, active)
            return new Promise<unknown>(resolve =>
                setTimeout(() => { active--; resolve({ data: {}, status: 200 }) }, 0)
            )
        })

        const { execute } = useApiBatch(['/a', '/b'], { concurrency: 100 })
        await execute()

        // Both run in parallel even with concurrency: 100 (larger than 2 items)
        expect(peak).toBe(2)
        expect(mockRequest).toHaveBeenCalledTimes(2)
    })

    it('concurrency:1 with abort stops pending items correctly', async () => {
        const signals: AbortSignal[] = []

        mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
            if (config.signal) signals.push(config.signal)
            return new Promise((_, reject) => {
                config.signal?.addEventListener('abort', () =>
                    reject(Object.assign(new Error('canceled'), {
                        isAxiosError: true, code: 'ERR_CANCELED', response: null,
                    }))
                )
            })
        })

        const { execute, abort } = useApiBatch(['/a', '/b', '/c'], { concurrency: 1 })
        const p = execute()

        // Wait for first request to register
        await new Promise(r => setTimeout(r, 0))
        abort()
        await p.catch(() => {})

        // Every signal that was created should be aborted
        expect(signals.every(s => s.aborted)).toBe(true)
    })
})
```

- [ ] **Step 2: Run and verify all pass**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All new tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: cover settled:false error details and concurrency edge cases"
```

---

## Task 6: poll whenHidden:true + abort robustness + reset during execution

**Files:**
- Modify: `packages/use-api/src/useApiBatch.test.ts`

- [ ] **Step 1: Append the tests**

```ts
// ---------------------------------------------------------------------------
// Coverage: poll whenHidden:true
// ---------------------------------------------------------------------------

describe('useApiBatch — poll whenHidden:true', () => {
    it('poll:{whenHidden:true} continues polling even when tab is hidden', async () => {
        vi.useFakeTimers()
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        Object.defineProperty(document, 'hidden', { value: true, configurable: true })

        const { execute } = useApiBatch(['/a'], { poll: { interval: 100, whenHidden: true } })
        await execute()

        expect(mockRequest).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(100)

        // whenHidden:true — re-executes even when tab is hidden
        expect(mockRequest).toHaveBeenCalledTimes(2)

        Object.defineProperty(document, 'hidden', { value: false, configurable: true })
        vi.useRealTimers()
    })
})

// ---------------------------------------------------------------------------
// Coverage: abort robustness
// ---------------------------------------------------------------------------

describe('useApiBatch — abort robustness', () => {
    it('calling abort() twice is idempotent — no errors thrown', async () => {
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { execute, abort } = useApiBatch(['/a'])
        await execute()

        expect(() => {
            abort()
            abort()
        }).not.toThrow()
    })

    it('calling abort() before execute() does not throw', () => {
        const { abort } = useApiBatch(['/a'])
        expect(() => abort()).not.toThrow()
    })

    it('abort() sets loading to false', async () => {
        mockRequest.mockImplementation((config: { signal?: AbortSignal }) =>
            new Promise((_, reject) => {
                config.signal?.addEventListener('abort', () =>
                    reject(Object.assign(new Error('canceled'), {
                        isAxiosError: true, code: 'ERR_CANCELED', response: null,
                    }))
                )
            })
        )

        const { execute, abort, loading } = useApiBatch(['/a'])
        const p = execute()
        await new Promise(r => setTimeout(r, 0))

        expect(loading.value).toBe(true)
        abort()
        await p.catch(() => {})

        expect(loading.value).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Coverage: reset() during execution
// ---------------------------------------------------------------------------

describe('useApiBatch — reset() during execution', () => {
    it('reset() during in-flight execution aborts requests and clears all state', async () => {
        mockRequest.mockImplementation((config: { signal?: AbortSignal }) =>
            new Promise((_, reject) => {
                config.signal?.addEventListener('abort', () =>
                    reject(Object.assign(new Error('canceled'), {
                        isAxiosError: true, code: 'ERR_CANCELED', response: null,
                    }))
                )
            })
        )

        const { execute, reset, loading, data, errors } = useApiBatch(['/a', '/b'])
        const p = execute()
        await new Promise(r => setTimeout(r, 0))

        expect(loading.value).toBe(true)
        reset()

        expect(loading.value).toBe(false)
        expect(data.value).toHaveLength(0)
        expect(errors.value).toHaveLength(0)

        await p.catch(() => {})
    })

    it('reset() clears poll timer — no re-execution after reset', async () => {
        vi.useFakeTimers()
        mockRequest.mockResolvedValue({ data: {}, status: 200 })

        const { execute, reset } = useApiBatch(['/a'], { poll: 100 })
        await execute()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        reset()

        await vi.advanceTimersByTimeAsync(200)

        // Timer cleared by reset — no second execution
        expect(mockRequest).toHaveBeenCalledTimes(1)

        vi.useRealTimers()
    })
})
```

- [ ] **Step 2: Run the full test suite to confirm everything passes**

```bash
cd packages/use-api && pnpm test -- --run --reporter=verbose useApiBatch
```

Expected: All tests pass.

- [ ] **Step 3: Run the complete test suite (all files)**

```bash
cd packages/use-api && pnpm test -- --run
```

Expected: All tests pass — no regressions in other files.

- [ ] **Step 4: Commit**

```bash
git add packages/use-api/src/useApiBatch.test.ts
git commit -m "test: cover poll whenHidden:true, abort robustness, reset during execution"
```

---

## Post-Implementation Checklist

- [ ] All tests in `useApiBatch.test.ts` pass: `cd packages/use-api && pnpm test -- --run useApiBatch`
- [ ] No regressions: `cd packages/use-api && pnpm test -- --run`
- [ ] Build clean: `cd packages/use-api && pnpm build`
