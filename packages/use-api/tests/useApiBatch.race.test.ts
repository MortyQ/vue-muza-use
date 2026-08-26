/**
 * useApiBatch — run isolation under reset / replace / abort
 *
 * Regression cover for the production crash
 * `TypeError: Cannot read properties of undefined (reading 'success')`:
 * `execute()` used to resolve with a copy of the shared `data` ref, which
 * `reset()` (or a shorter replacing run) could empty mid-flight, leaving holes
 * that `[...data.value]` materialised as `undefined`.
 *
 * Covers:
 *  - a run always resolves with its own dense snapshot
 *  - a discarded run stops writing to data/errors/progress and firing callbacks
 *  - a replaced run does not clear the loading state of the run that replaced it
 *  - cancelled items are `aborted`, not failures — no BATCH_ALL_FAILED
 *  - internal (poll / auto-tracked) runs never leak an unhandled rejection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useApiBatch } from '../src/useApiBatch'
import { createApi } from '../src/plugin'
import { clearAllCache } from '../src/features/cacheManager'
import type { BatchResultItem } from '../src/types'

const mockRequest = vi.fn()
const mockAxios = {
    request: mockRequest,
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

function axiosError(status: number, message = 'Error') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    })
}

function canceledError() {
    return Object.assign(new Error('canceled'), {
        isAxiosError: true,
        code: 'ERR_CANCELED',
        response: null,
    })
}

interface PendingRequest {
    url: string
    resolve: () => void
    fail: (status?: number) => void
}

/**
 * Every request is held open until the test releases it, and rejects like Axios
 * as soon as its signal is aborted — the only way to observe what a cancelled
 * run does on its way out.
 */
function controlled(): PendingRequest[] {
    const pending: PendingRequest[] = []
    mockRequest.mockImplementation((config: { url?: string; signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
            config.signal?.addEventListener('abort', () => reject(canceledError()), { once: true })
            pending.push({
                url: config.url ?? '',
                resolve: () => resolve({ data: { url: config.url }, status: 200 }),
                fail: (status = 500) => reject(axiosError(status)),
            })
        }),
    )
    return pending
}

function respondWithUrl() {
    mockRequest.mockImplementation((config: { url?: string }) =>
        Promise.resolve({ data: { url: config.url }, status: 200 }),
    )
}

/** Let the batch reach mockRequest for every job it started. */
const settleMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0))

const openScopes: EffectScope[] = []
function inScope<T>(factory: () => T): T {
    const scope = effectScope()
    openScopes.push(scope)
    return scope.run(factory)!
}

beforeEach(() => {
    vi.clearAllMocks()
    clearAllCache()
    createApi({ axios: mockAxios })
})

afterEach(() => {
    openScopes.splice(0).forEach(scope => scope.stop())
    vi.clearAllMocks()
    vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// reset() while requests are in flight
// ---------------------------------------------------------------------------

describe('useApiBatch — reset() during an in-flight run', () => {
    it('resolves with a dense snapshot when a fresh cache hit sits next to in-flight misses', async () => {
        // The production shape: one item served from a still-fresh cache entry
        // (settled before any network work, therefore never re-published after
        // reset()), the rest in flight.
        respondWithUrl()
        const cacheOptions = { swr: true, freshFor: '1m', staleTime: '5m' } as const

        const warm = useApiBatch(['/a'], { cache: cacheOptions })
        await warm.execute()
        expect(mockRequest).toHaveBeenCalledTimes(1)

        controlled()
        const batch = useApiBatch(['/a', '/b', '/c', '/d'], { cache: cacheOptions })
        const pending = batch.execute()
        await settleMicrotasks()

        expect(batch.data.value[0].status).toBe('success')   // fresh cache hit, no job queued
        expect(mockRequest).toHaveBeenCalledTimes(4)         // 1 warm-up + 3 misses

        batch.reset()

        const results = await pending
        expect(results).toHaveLength(4)
        expect(results.some(item => item === undefined)).toBe(false)
        expect(results.map(item => item.status)).toEqual(['success', 'aborted', 'aborted', 'aborted'])
        expect(batch.error.value).toBeNull()
    })

    it('does not revive state after reset() when nothing was cached', async () => {
        const pendingRequests = controlled()
        const onFinish = vi.fn()
        const onItemSuccess = vi.fn()
        const onItemError = vi.fn()

        const batch = useApiBatch(['/a', '/b'], { onFinish, onItemSuccess, onItemError })
        const pending = batch.execute()
        await settleMicrotasks()

        batch.reset()
        // Late arrivals from the discarded run — one success, one failure
        pendingRequests[0].resolve()
        pendingRequests[1].fail()

        const results = await pending
        expect(results).toHaveLength(2)

        expect(batch.data.value).toEqual([])
        expect(batch.errors.value).toEqual([])
        expect(batch.error.value).toBeNull()
        expect(batch.progress.value.completed).toBe(0)
        expect(batch.loading.value).toBe(false)
        expect(onFinish).not.toHaveBeenCalled()
        expect(onItemSuccess).not.toHaveBeenCalled()
        expect(onItemError).not.toHaveBeenCalled()
    })

    it('keeps reset() harmless when no run is in flight (default behavior)', async () => {
        respondWithUrl()

        const batch = useApiBatch(['/a', '/b'])
        await batch.execute()
        expect(batch.data.value).toHaveLength(2)

        batch.reset()
        expect(batch.data.value).toEqual([])

        const results = await batch.execute()
        expect(results.map(item => item.status)).toEqual(['success', 'success'])
        expect(batch.progress.value.completed).toBe(2)
    })
})

// ---------------------------------------------------------------------------
// execute() replacing an in-flight run
// ---------------------------------------------------------------------------

describe('useApiBatch — a replacing execute()', () => {
    it('is unaffected by a longer previous run', async () => {
        const pendingRequests = controlled()
        const urls = ref(['/a', '/b', '/c'])

        const batch = useApiBatch(() => urls.value, { lazy: true })
        const first = batch.execute()
        await settleMicrotasks()

        urls.value = ['/only']
        const second = batch.execute()
        await settleMicrotasks()

        // The old run answers only after the new one seeded its shorter array
        pendingRequests.filter(req => req.url !== '/only').forEach(req => req.resolve())
        pendingRequests.filter(req => req.url === '/only').forEach(req => req.resolve())

        const [firstResults, secondResults] = await Promise.all([first, second])

        expect(firstResults).toHaveLength(3)
        expect(secondResults).toHaveLength(1)
        expect(secondResults[0].status).toBe('success')
        expect(batch.data.value).toHaveLength(1)
        expect(batch.data.value.some(item => item === undefined)).toBe(false)
        expect(batch.error.value).toBeNull()
    })

    it('is not un-loaded by the previous run finishing', async () => {
        const pendingRequests = controlled()

        const batch = useApiBatch(['/a', '/b'])
        const first = batch.execute()
        await settleMicrotasks()

        const second = batch.execute()
        await settleMicrotasks()
        expect(batch.loading.value).toBe(true)

        // Old run unwinds — it must not clear the new run's loading state,
        // and must not empty the controller list that abort() relies on.
        const firstRunRequests = pendingRequests.splice(0, 2)
        firstRunRequests.forEach(req => req.resolve())
        await first

        expect(batch.loading.value).toBe(true)
        expect(batch.progress.value.succeeded).toBeLessThanOrEqual(2)

        batch.abort('still cancellable')
        const secondResults = await second

        expect(secondResults.map(item => item.status)).toEqual(['aborted', 'aborted'])
        expect(batch.loading.value).toBe(false)
        expect(batch.progress.value.succeeded).toBeLessThanOrEqual(2)
    })
})

// ---------------------------------------------------------------------------
// aborted is not failed
// ---------------------------------------------------------------------------

describe('useApiBatch — cancelled items are not failures', () => {
    it('abort() leaves no aggregated error and no entries in errors', async () => {
        controlled()
        const onItemError = vi.fn()

        const batch = useApiBatch(['/a', '/b'], { onItemError })
        const pending = batch.execute()
        await settleMicrotasks()

        batch.abort()
        const results = await pending

        expect(results.map(item => item.status)).toEqual(['aborted', 'aborted'])
        expect(results.every(item => item.error === null)).toBe(true)
        expect(batch.error.value).toBeNull()
        expect(batch.errors.value).toEqual([])
        expect(onItemError).not.toHaveBeenCalled()
        expect(batch.data.value.map(item => item.status)).toEqual(['aborted', 'aborted'])
    })

    it('still reports a genuine all-failed batch', async () => {
        mockRequest.mockRejectedValue(axiosError(500))

        const batch = useApiBatch(['/a', '/b'])
        const results = await batch.execute()

        expect(results.map(item => item.status)).toEqual(['error', 'error'])
        expect(batch.error.value?.code).toBe('BATCH_ALL_FAILED')
        expect(batch.error.value?.message).toBe('All 2 requests failed')
    })

    it('ignores cancelled siblings when deciding all-failed', async () => {
        const pendingRequests = controlled()

        const batch = useApiBatch(['/a', '/b'])
        const pending = batch.execute()
        await settleMicrotasks()

        pendingRequests[0].fail()
        await settleMicrotasks()
        batch.abort()

        const results = await pending
        expect(results.map(item => item.status)).toEqual(['error', 'aborted'])
        // One answered, and it failed — that is still an all-failed batch of one
        expect(batch.error.value?.message).toBe('All 1 requests failed')
        expect(batch.errors.value).toHaveLength(1)
    })

    it('marks jobs that never started under a concurrency limit as aborted', async () => {
        const pendingRequests = controlled()

        const batch = useApiBatch(['/a', '/b', '/c'], { concurrency: 1 })
        const pending = batch.execute()
        await settleMicrotasks()

        expect(pendingRequests).toHaveLength(1)   // serialised — only /a started
        batch.abort()

        const results = await pending
        expect(results.map(item => item.status)).toEqual(['aborted', 'aborted', 'aborted'])
        expect(batch.error.value).toBeNull()
        expect(batch.errors.value).toEqual([])
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('keeps the cached value of a cancelled SWR revalidation on screen', async () => {
        respondWithUrl()

        const batch = useApiBatch(['/a'], { cache: { swr: true } })
        await batch.execute()

        controlled()
        const pending = batch.execute()
        await settleMicrotasks()
        expect(batch.revalidating.value).toBe(true)

        batch.abort()
        const results = await pending

        expect(results[0].status).toBe('aborted')
        expect(results[0].data).toEqual({ url: '/a' })
        expect(results[0].stale).toBe(true)
        expect(batch.revalidating.value).toBe(false)
        expect(batch.error.value).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Internal runs must not leak rejections
// ---------------------------------------------------------------------------

describe('useApiBatch — internal runs never leak an unhandled rejection', () => {
    const collectUnhandled = () => {
        const seen: unknown[] = []
        const handler = (reason: unknown) => { seen.push(reason) }
        process.on('unhandledRejection', handler)
        return {
            seen,
            stop: () => { process.off('unhandledRejection', handler) },
        }
    }

    it('swallows the rejection of an auto-tracked run in settled: false mode', async () => {
        mockRequest.mockRejectedValue(axiosError(500))
        const watcher = collectUnhandled()

        try {
            const urls = ref(['/a'])
            const batch = inScope(() => useApiBatch(() => urls.value, { settled: false }))
            await vi.waitFor(() => expect(batch.error.value).not.toBeNull())

            urls.value = ['/b']
            await nextTick()
            await new Promise(resolve => setTimeout(resolve, 20))

            expect(watcher.seen).toEqual([])
        } finally {
            watcher.stop()
        }
    })

    it('swallows the rejection of a polled run in settled: false mode', async () => {
        // The first run has to succeed — only then is a poll tick scheduled,
        // and it is that tick's rejection nobody is awaiting.
        mockRequest
            .mockResolvedValueOnce({ data: { url: '/a' }, status: 200 })
            .mockRejectedValue(axiosError(500))
        const watcher = collectUnhandled()

        try {
            const batch = inScope(() => useApiBatch(['/a'], { settled: false, poll: 5 }))
            await batch.execute()
            await vi.waitFor(() => expect(mockRequest.mock.calls.length).toBeGreaterThan(1))
            await new Promise(resolve => setTimeout(resolve, 40))

            expect(watcher.seen).toEqual([])
            batch.reset()
        } finally {
            watcher.stop()
        }
    })

    it('still exposes the failure in error when execute() rejects', async () => {
        mockRequest.mockRejectedValue(axiosError(500))

        const batch = useApiBatch(['/a'], { settled: false })
        await expect(batch.execute()).rejects.toBeTruthy()
        expect(batch.error.value).not.toBeNull()
    })
})

// ---------------------------------------------------------------------------
// onFinish always receives a dense array
// ---------------------------------------------------------------------------

describe('useApiBatch — onFinish payload', () => {
    it('receives the run snapshot, never an empty array, when a request fails hard', async () => {
        mockRequest.mockRejectedValue(axiosError(500))
        const onFinish = vi.fn()

        const batch = useApiBatch(['/a', '/b'], { settled: false, onFinish })
        await batch.execute().catch(() => {})

        expect(onFinish).toHaveBeenCalledOnce()
        const results = onFinish.mock.calls[0][0] as BatchResultItem<unknown>[]
        expect(results).toHaveLength(2)
        expect(results.some(item => item === undefined)).toBe(false)
    })
})
