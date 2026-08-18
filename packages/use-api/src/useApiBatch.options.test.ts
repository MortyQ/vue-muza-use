/**
 * useApiBatch — useApi option whitelist
 *
 * Covers the options that `useApiBatch` forwards to (or implements on top of)
 * the per-request `useApi` instances:
 *  - cache (auto-keyed, per request)
 *  - invalidateCache
 *  - select
 *  - refetchOnFocus / refetchOnReconnect (batch-level)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { useApiBatch } from './useApiBatch'
import { createApi } from './plugin'
import { clearAllCache } from './features/cacheManager'

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------

const mockRequest = vi.fn()
const mockAxios = {
    request: mockRequest,
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

/** Resolve every request with `{ url: <requested url> }` so items stay distinguishable. */
function respondWithUrl() {
    mockRequest.mockImplementation((config: { url?: string }) =>
        Promise.resolve({ data: { url: config.url }, status: 200 }),
    )
}

function requestedUrls(): string[] {
    return mockRequest.mock.calls.map(call => (call[0] as { url?: string }).url ?? '')
}

/**
 * Create a batch inside its own effect scope and dispose it after the test.
 * Without this, a `refetchOnFocus` listener registered by an earlier test would
 * still answer the next test's focus/online event and skew the call counts.
 */
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
// cache
// ---------------------------------------------------------------------------

describe('useApiBatch — cache', () => {
    describe('when the option is absent (default)', () => {
        it('hits the network on every execute', async () => {
            respondWithUrl()

            const { execute } = useApiBatch(['/a', '/b'])
            await execute()
            await execute()

            expect(mockRequest).toHaveBeenCalledTimes(4)
        })
    })

    describe('when cache is enabled', () => {
        it('serves the second execute from cache without any request', async () => {
            respondWithUrl()

            const { data, execute } = useApiBatch(['/a', '/b'], { cache: true })
            await execute()
            expect(mockRequest).toHaveBeenCalledTimes(2)

            await execute()
            expect(mockRequest).toHaveBeenCalledTimes(2)
            expect(data.value.map(item => item.data)).toEqual([{ url: '/a' }, { url: '/b' }])
            expect(data.value.every(item => item.success)).toBe(true)
        })

        it('keys each request separately — only the new URL hits the network', async () => {
            respondWithUrl()

            const first = useApiBatch(['/a', '/b'], { cache: true })
            await first.execute()

            const second = useApiBatch(['/b', '/c'], { cache: true })
            await second.execute()

            expect(requestedUrls()).toEqual(['/a', '/b', '/c'])
            expect(second.data.value.map(item => item.data)).toEqual([{ url: '/b' }, { url: '/c' }])
        })

        it('gives distinct params their own entry', async () => {
            respondWithUrl()

            const { execute } = useApiBatch(
                [
                    { url: '/items', params: { page: 1 } },
                    { url: '/items', params: { page: 2 } },
                ],
                { cache: true },
            )
            await execute()
            await execute()

            expect(mockRequest).toHaveBeenCalledTimes(2)
        })

        it('re-fetches once staleTime has elapsed', async () => {
            respondWithUrl()
            vi.useFakeTimers()

            const { execute } = useApiBatch(['/a'], { cache: { staleTime: '1m' } })
            await execute()
            expect(mockRequest).toHaveBeenCalledTimes(1)

            vi.setSystemTime(Date.now() + 30_000)
            await execute()
            expect(mockRequest).toHaveBeenCalledTimes(1)

            vi.setSystemTime(Date.now() + 61_000)
            await execute()
            expect(mockRequest).toHaveBeenCalledTimes(2)
        })
    })

    describe('edge cases', () => {
        it('does not cache a failed request', async () => {
            mockRequest
                .mockRejectedValueOnce(Object.assign(new Error('boom'), {
                    isAxiosError: true,
                    response: { status: 500, data: {} },
                }))
                .mockResolvedValueOnce({ data: { url: '/a' }, status: 200 })

            const { execute } = useApiBatch(['/a'], { cache: true })
            await execute()
            const second = await execute()

            expect(mockRequest).toHaveBeenCalledTimes(2)
            expect(second[0].success).toBe(true)
        })

        it('works together with concurrency', async () => {
            respondWithUrl()

            const { execute } = useApiBatch(['/a', '/b', '/c'], { cache: true, concurrency: 2 })
            await execute()
            await execute()

            expect(mockRequest).toHaveBeenCalledTimes(3)
        })
    })
})

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------

describe('useApiBatch — invalidateCache', () => {
    it('busts cached entries after a successful batch', async () => {
        respondWithUrl()

        const reads = useApiBatch(['/a', '/b'], { cache: true })
        await reads.execute()
        await reads.execute()
        expect(mockRequest).toHaveBeenCalledTimes(2)

        const writes = useApiBatch(
            [{ url: '/a', method: 'POST', data: { x: 1 } }],
            { invalidateCache: { prefix: 'auto:GET:/a' } },
        )
        await writes.execute()

        await reads.execute()
        // /a re-fetched, /b still served from cache
        expect(requestedUrls()).toEqual(['/a', '/b', '/a', '/a'])
    })
})

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------

describe('useApiBatch — select', () => {
    it('is not applied when absent (default)', async () => {
        respondWithUrl()

        const { successfulData, execute } = useApiBatch(['/a'])
        await execute()

        expect(successfulData.value).toEqual([{ url: '/a' }])
    })

    it('transforms each item and feeds data, successfulData and onItemSuccess', async () => {
        respondWithUrl()
        const onItemSuccess = vi.fn()

        const { data, successfulData, execute } = useApiBatch<string, { url: string }>(
            ['/a', '/b'],
            { select: res => res.url.toUpperCase(), onItemSuccess },
        )
        await execute()

        expect(successfulData.value).toEqual(['/A', '/B'])
        expect(data.value.map(item => item.data)).toEqual(['/A', '/B'])
        expect(onItemSuccess.mock.calls[0][0].data).toBe('/A')
    })

    it('is re-applied to cached data on a cache hit', async () => {
        respondWithUrl()

        const { successfulData, execute } = useApiBatch<string, { url: string }>(
            ['/a'],
            { cache: true, select: res => res.url.toUpperCase() },
        )
        await execute()
        await execute()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(successfulData.value).toEqual(['/A'])
    })
})

// ---------------------------------------------------------------------------
// refetchOnFocus / refetchOnReconnect
// ---------------------------------------------------------------------------

describe('useApiBatch — refetchOnFocus', () => {
    it('does not listen when absent (default)', async () => {
        respondWithUrl()

        const { execute } = useApiBatch(['/a'])
        await execute()

        document.dispatchEvent(new Event('visibilitychange'))
        await nextTick()

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('re-executes the whole batch on focus', async () => {
        respondWithUrl()

        const { execute } = inScope(() => useApiBatch(['/a', '/b'], { refetchOnFocus: { throttle: 0 } }))
        await execute()
        expect(mockRequest).toHaveBeenCalledTimes(2)

        document.dispatchEvent(new Event('visibilitychange'))
        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(4))
        expect(requestedUrls()).toEqual(['/a', '/b', '/a', '/b'])
    })

    it('throttles repeated focus events', async () => {
        respondWithUrl()

        const { execute } = inScope(() => useApiBatch(['/a'], { refetchOnFocus: true }))
        await execute()

        document.dispatchEvent(new Event('visibilitychange'))
        await nextTick()

        // default 60s throttle — the request that just completed suppresses this one
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('skips the refetch while the batch is already running', async () => {
        let resolveRequest: ((value: unknown) => void) | undefined
        mockRequest.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve }))

        const { execute } = inScope(() => useApiBatch(['/a'], { refetchOnFocus: { throttle: 0 } }))
        const pending = execute()
        await nextTick()

        document.dispatchEvent(new Event('visibilitychange'))
        await nextTick()
        expect(mockRequest).toHaveBeenCalledTimes(1)

        resolveRequest?.({ data: { url: '/a' }, status: 200 })
        await pending
    })

    it('stops listening after the owning scope is disposed', async () => {
        respondWithUrl()

        const scope = effectScope()
        const batch = scope.run(() => useApiBatch(['/a'], { refetchOnFocus: { throttle: 0 } }))!
        await batch.execute()
        expect(mockRequest).toHaveBeenCalledTimes(1)

        scope.stop()
        document.dispatchEvent(new Event('visibilitychange'))
        await nextTick()

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })
})

describe('useApiBatch — refetchOnReconnect', () => {
    it('does not listen when absent (default)', async () => {
        respondWithUrl()

        const { execute } = useApiBatch(['/a'])
        await execute()

        window.dispatchEvent(new Event('online'))
        await nextTick()

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('re-executes the batch when connectivity returns', async () => {
        respondWithUrl()

        const { execute } = inScope(() => useApiBatch(['/a'], { refetchOnReconnect: true }))
        await execute()

        window.dispatchEvent(new Event('online'))
        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))
    })

    it('serves the refetch from cache when cache is enabled', async () => {
        respondWithUrl()

        const { execute } = inScope(() => useApiBatch(['/a'], { refetchOnReconnect: true, cache: true }))
        await execute()

        window.dispatchEvent(new Event('online'))
        await nextTick()
        await nextTick()

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('stops listening after the owning scope is disposed', async () => {
        respondWithUrl()

        const scope = effectScope()
        const batch = scope.run(() => useApiBatch(['/a'], { refetchOnReconnect: true }))!
        await batch.execute()

        scope.stop()
        window.dispatchEvent(new Event('online'))
        await nextTick()

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })
})
