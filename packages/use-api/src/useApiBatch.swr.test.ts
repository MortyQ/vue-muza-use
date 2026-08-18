/**
 * useApiBatch — incremental publishing and SWR
 *
 * Covers:
 *  - `data` is seeded with pending items and filled in as results land
 *  - `cache: { swr: true }` — cached items published immediately as stale,
 *    refreshed in the background, `revalidating` reflects the refresh
 *  - `freshFor` suppresses the background call
 *  - a failed revalidation keeps the cached data AND surfaces the error
 *  - callbacks/progress fire on the final state, not on the stale publish
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { effectScope, type EffectScope } from 'vue'
import { useApiBatch } from './useApiBatch'
import { createApi } from './plugin'
import { clearAllCache } from './features/cacheManager'

const mockRequest = vi.fn()
const mockAxios = {
    request: mockRequest,
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

function respondWithUrl() {
    mockRequest.mockImplementation((config: { url?: string }) =>
        Promise.resolve({ data: { url: config.url }, status: 200 }),
    )
}

function axiosError(status: number, message = 'Error') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    })
}

/** Deferred response for one URL, so a request can be held open mid-test. */
function deferredFor(url: string) {
    let release!: (value: unknown) => void
    const gate = new Promise(resolve => { release = resolve })
    mockRequest.mockImplementation((config: { url?: string }) =>
        config.url === url
            ? gate.then(() => ({ data: { url: config.url }, status: 200 }))
            : Promise.resolve({ data: { url: config.url }, status: 200 }),
    )
    return { release: () => release(undefined) }
}

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
// Incremental publishing (no cache involved)
// ---------------------------------------------------------------------------

describe('useApiBatch — incremental publishing', () => {
    it('seeds data with pending items of the final length', async () => {
        const { release } = deferredFor('/slow')

        const { data, execute } = useApiBatch(['/fast', '/slow'])
        const pending = execute()

        expect(data.value).toHaveLength(2)
        expect(data.value.map(item => item.status)).toEqual(['pending', 'pending'])
        expect(data.value.map(item => item.url)).toEqual(['/fast', '/slow'])
        expect(data.value.every(item => item.data === null)).toBe(true)

        release()
        await pending
    })

    it('publishes a fast item before a slow sibling resolves', async () => {
        const { release } = deferredFor('/slow')

        const { data, successfulData, execute } = useApiBatch(['/fast', '/slow'])
        const pending = execute()

        await vi.waitFor(() => expect(data.value[0].status).toBe('success'))
        expect(data.value[0].data).toEqual({ url: '/fast' })
        expect(data.value[1].status).toBe('pending')
        expect(successfulData.value).toEqual([{ url: '/fast' }])

        release()
        await pending
        expect(data.value.map(item => item.status)).toEqual(['success', 'success'])
    })

    it('marks a failed item as error with null data', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { url: '/a' }, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const { data, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(data.value.map(item => item.status)).toEqual(['success', 'error'])
        expect(data.value[1].data).toBeNull()
        expect(data.value[1].stale).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// SWR
// ---------------------------------------------------------------------------

describe('useApiBatch — cache: { swr: true }', () => {
    describe('when nothing is cached yet', () => {
        it('behaves like a normal batch and never sets revalidating', async () => {
            respondWithUrl()

            const { data, loading, revalidating, execute } = useApiBatch(['/a'], { cache: { swr: true } })
            const pending = execute()

            expect(loading.value).toBe(true)
            expect(revalidating.value).toBe(false)

            await pending
            expect(data.value[0].stale).toBe(false)
            expect(mockRequest).toHaveBeenCalledTimes(1)
        })
    })

    describe('when every item is cached', () => {
        it('publishes cached data synchronously, without loading, and refreshes in the background', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a', '/b'], { cache: { swr: true } })
            await batch.execute()
            expect(mockRequest).toHaveBeenCalledTimes(2)

            const pending = batch.execute()

            // Synchronously after execute() — before any network round trip
            expect(batch.loading.value).toBe(false)
            expect(batch.revalidating.value).toBe(true)
            expect(batch.data.value.map(item => item.status)).toEqual(['success', 'success'])
            expect(batch.data.value.every(item => item.stale)).toBe(true)
            expect(batch.successfulData.value).toEqual([{ url: '/a' }, { url: '/b' }])

            await pending

            expect(batch.revalidating.value).toBe(false)
            expect(batch.data.value.every(item => !item.stale)).toBe(true)
            expect(mockRequest).toHaveBeenCalledTimes(4)
        })
    })

    describe('when only part of the batch is cached', () => {
        it('shows cached items immediately and keeps the miss pending', async () => {
            respondWithUrl()

            const first = useApiBatch(['/a', '/b'], { cache: { swr: true } })
            await first.execute()

            const second = useApiBatch(['/a', '/b', '/c'], { cache: { swr: true } })
            const pending = second.execute()

            expect(second.loading.value).toBe(true)
            expect(second.revalidating.value).toBe(true)
            expect(second.data.value.map(item => item.status)).toEqual(['success', 'success', 'pending'])
            expect(second.data.value.map(item => item.stale)).toEqual([true, true, false])

            await pending

            expect(second.loading.value).toBe(false)
            expect(second.revalidating.value).toBe(false)
            expect(second.data.value.map(item => item.stale)).toEqual([false, false, false])
        })
    })

    describe('freshFor', () => {
        it('serves a young entry without any background request', async () => {
            respondWithUrl()
            vi.useFakeTimers()

            const batch = useApiBatch(['/a'], { cache: { swr: true, freshFor: '1m' } })
            await batch.execute()
            expect(mockRequest).toHaveBeenCalledTimes(1)

            vi.setSystemTime(Date.now() + 30_000)
            const pending = batch.execute()
            expect(batch.revalidating.value).toBe(false)
            expect(batch.data.value[0].stale).toBe(false)
            await pending
            expect(mockRequest).toHaveBeenCalledTimes(1)

            vi.setSystemTime(Date.now() + 61_000)
            await batch.execute()
            expect(mockRequest).toHaveBeenCalledTimes(2)
        })
    })

    describe('when revalidation fails', () => {
        it('keeps the cached data and still surfaces the error', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a'], { cache: { swr: true } })
            await batch.execute()

            mockRequest.mockRejectedValueOnce(axiosError(503, 'Gateway down'))
            await batch.execute()

            const item = batch.data.value[0]
            expect(item.status).toBe('error')
            expect(item.success).toBe(false)
            expect(item.stale).toBe(true)
            expect(item.data).toEqual({ url: '/a' })          // cached value survives
            expect(item.error?.status).toBe(503)
            expect(batch.errors.value).toHaveLength(1)
            expect(batch.successfulData.value).toEqual([])    // excluded — it did fail
            expect(batch.revalidating.value).toBe(false)
        })

        it('does not abort siblings in settled: false mode', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a'], { cache: { swr: true }, settled: false })
            await batch.execute()

            mockRequest.mockRejectedValueOnce(axiosError(503))
            await expect(batch.execute()).resolves.toHaveLength(1)
            expect(batch.data.value[0].data).toEqual({ url: '/a' })
        })
    })

    describe('callbacks and progress', () => {
        it('fires onItemSuccess once, after revalidation — not on the stale publish', async () => {
            respondWithUrl()
            const onItemSuccess = vi.fn()

            const batch = useApiBatch(['/a'], { cache: { swr: true }, onItemSuccess })
            await batch.execute()
            expect(onItemSuccess).toHaveBeenCalledTimes(1)

            const pending = batch.execute()
            expect(onItemSuccess).toHaveBeenCalledTimes(1)   // stale publish is silent
            await pending
            expect(onItemSuccess).toHaveBeenCalledTimes(2)
            expect(onItemSuccess.mock.calls[1][0].stale).toBe(false)
        })

        it('fires onItemError for a failed revalidation, with the cached data attached', async () => {
            respondWithUrl()
            const onItemError = vi.fn()

            const batch = useApiBatch(['/a'], { cache: { swr: true }, onItemError })
            await batch.execute()

            mockRequest.mockRejectedValueOnce(axiosError(503))
            await batch.execute()

            expect(onItemError).toHaveBeenCalledTimes(1)
            expect(onItemError.mock.calls[0][0].data).toEqual({ url: '/a' })
        })

        it('counts a stale item as completed only once revalidation settles', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a'], { cache: { swr: true } })
            await batch.execute()

            const pending = batch.execute()
            expect(batch.progress.value.completed).toBe(0)
            await pending
            expect(batch.progress.value).toMatchObject({ completed: 1, total: 1, succeeded: 1, failed: 0 })
        })
    })

    describe('edge cases and integration', () => {
        it('applies select to the stale value too', async () => {
            respondWithUrl()

            const batch = useApiBatch<string, { url: string }>(
                ['/a'],
                { cache: { swr: true }, select: res => res.url.toUpperCase() },
            )
            await batch.execute()

            const pending = batch.execute()
            expect(batch.data.value[0].data).toBe('/A')
            expect(batch.data.value[0].stale).toBe(true)
            await pending
            expect(batch.data.value[0].data).toBe('/A')
        })

        it('works with a concurrency limit', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a', '/b', '/c'], { cache: { swr: true }, concurrency: 2 })
            await batch.execute()

            const pending = batch.execute()
            expect(batch.data.value.every(item => item.stale)).toBe(true)
            await pending

            expect(batch.data.value.every(item => !item.stale)).toBe(true)
            expect(mockRequest).toHaveBeenCalledTimes(6)
        })

        it('clears revalidating on reset()', async () => {
            respondWithUrl()

            const batch = useApiBatch(['/a'], { cache: { swr: true } })
            await batch.execute()

            void batch.execute().catch(() => {})
            expect(batch.revalidating.value).toBe(true)

            batch.reset()
            expect(batch.revalidating.value).toBe(false)
            expect(batch.data.value).toEqual([])
        })

        it('aborts an in-flight revalidation when the scope is disposed', async () => {
            respondWithUrl()

            const scope = effectScope()
            const batch = scope.run(() => useApiBatch(['/a'], { cache: { swr: true } }))!
            await batch.execute()

            const { release } = deferredFor('/a')
            const pending = batch.execute()
            scope.stop()

            release()
            await pending
            expect(batch.revalidating.value).toBe(false)
        })
    })
})
