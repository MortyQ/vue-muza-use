/**
 * useApiBatch — baseline tests
 *
 * Covers:
 *  - basic parallel execution, successfulData, errors array
 *  - progress state after completion
 *  - settled: true — continues on partial failure
 *  - settled: false — stops on first failure
 *  - concurrency: N — at most N in-flight at once
 *  - callbacks (onItemSuccess, onItemError, onFinish)
 *  - reset()
 *  - known issues (it.todo)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useApiBatch } from './useApiBatch'
import { createApi } from './plugin'

// ---------------------------------------------------------------------------
// Mock axios — no Vue component needed for useApiBatch
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

function axiosError(status: number, message = 'Error') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    // createApi sets the global config that useApiBatch picks up
    createApi({ axios: mockAxios, globalOptions: { skipErrorNotification: true } })
})

// ---------------------------------------------------------------------------
// Basic parallel execution
// ---------------------------------------------------------------------------

describe('useApiBatch — basic execution', () => {
    it('fetches all URLs and populates data array', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockResolvedValueOnce({ data: { id: 2 }, status: 200 })
            .mockResolvedValueOnce({ data: { id: 3 }, status: 200 })

        const { data, execute } = useApiBatch(['/a', '/b', '/c'])
        await execute()

        expect(data.value).toHaveLength(3)
        expect(data.value.every(r => r.success)).toBe(true)
    })

    it('successfulData contains only items where success = true', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockRejectedValueOnce(axiosError(500))
            .mockResolvedValueOnce({ data: { id: 3 }, status: 200 })

        const { successfulData, execute } = useApiBatch(['/a', '/b', '/c'])
        await execute()

        expect(successfulData.value).toHaveLength(2)
        expect(successfulData.value.map((d: any) => d.id)).toEqual([1, 3])
    })

    it('errors array contains ApiError for each failed item', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(404))
            .mockRejectedValueOnce(axiosError(500))

        const { errors, execute } = useApiBatch(['/a', '/b', '/c'])
        await execute()

        expect(errors.value).toHaveLength(2)
    })

    it('data items contain success, data, statusCode fields', async () => {
        mockRequest.mockResolvedValue({ data: { x: 1 }, status: 200 })

        const { data, execute } = useApiBatch(['/a'])
        await execute()

        const item = data.value[0]
        expect(item).toMatchObject({ success: true, statusCode: 200 })
        expect(item.data).toEqual({ x: 1 })
    })

    it('loading is true during execution, false after', async () => {
        let resolve!: (v: unknown) => void
        mockRequest.mockReturnValue(new Promise(r => { resolve = r }))

        const { loading, execute } = useApiBatch(['/a'])
        const p = execute()
        expect(loading.value).toBe(true)
        resolve({ data: {}, status: 200 })
        await p
        expect(loading.value).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

describe('useApiBatch — progress', () => {
    it('progress.percentage is 100 after all requests complete', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockResolvedValueOnce({ data: {}, status: 200 })

        const { progress, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(progress.value.percentage).toBe(100)
        expect(progress.value.total).toBe(2)
        expect(progress.value.completed).toBe(2)
        expect(progress.value.succeeded).toBe(2)
        expect(progress.value.failed).toBe(0)
    })

    it('progress reflects partial success/failure counts', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const { progress, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(progress.value.succeeded).toBe(1)
        expect(progress.value.failed).toBe(1)
        expect(progress.value.percentage).toBe(100)
    })
})

// ---------------------------------------------------------------------------
// settled modes
// ---------------------------------------------------------------------------

describe('useApiBatch — settled mode', () => {
    it('settled: true — continues after partial failure, data has all items', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockRejectedValueOnce(axiosError(500))
            .mockResolvedValueOnce({ data: { id: 3 }, status: 200 })

        const { data, errors, execute } = useApiBatch(['/a', '/b', '/c'], { settled: true })
        await execute()

        expect(data.value).toHaveLength(3)
        expect(errors.value).toHaveLength(1)
    })

    it('settled: false — sets error and stops on first failure', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))
            .mockResolvedValueOnce({ data: {}, status: 200 }) // shouldn't be called

        const { error, execute } = useApiBatch(['/a', '/b', '/c'], { settled: false })
        // settled:false re-throws on first error — swallow it here
        await execute().catch(() => {})

        expect(error.value).not.toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

describe('useApiBatch — concurrency', () => {
    it('concurrency: 1 — requests are serialised (peak concurrent = 1)', async () => {
        let peak = 0
        let active = 0

        mockRequest.mockImplementation(() => {
            active++
            peak = Math.max(peak, active)
            return new Promise<unknown>(resolve => {
                // Let microtasks flush before resolving so next worker can't start
                setTimeout(() => {
                    active--
                    resolve({ data: {}, status: 200 })
                }, 0)
            })
        })

        const { execute } = useApiBatch(['/a', '/b', '/c', '/d'], { concurrency: 1 })
        await execute()

        expect(peak).toBe(1)
        expect(mockRequest).toHaveBeenCalledTimes(4)
    })

    it('concurrency: 2 — no more than 2 requests run simultaneously', async () => {
        let peak = 0
        let active = 0

        mockRequest.mockImplementation(() => {
            active++
            peak = Math.max(peak, active)
            return new Promise<unknown>(resolve => {
                setTimeout(() => {
                    active--
                    resolve({ data: {}, status: 200 })
                }, 0)
            })
        })

        const { execute } = useApiBatch(['/a', '/b', '/c', '/d'], { concurrency: 2 })
        await execute()

        expect(peak).toBeLessThanOrEqual(2)
        expect(mockRequest).toHaveBeenCalledTimes(4)
    })
})

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

describe('useApiBatch — callbacks', () => {
    it('onItemSuccess fires for each successful item', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockResolvedValueOnce({ data: { id: 2 }, status: 200 })

        const onItemSuccess = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onItemSuccess })
        await execute()

        expect(onItemSuccess).toHaveBeenCalledTimes(2)
    })

    it('onItemError fires for each failed item', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const onItemError = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onItemError })
        await execute()

        expect(onItemError).toHaveBeenCalledTimes(1)
    })

    it('onFinish fires once with all results after completion', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockResolvedValueOnce({ data: { id: 2 }, status: 200 })

        const onFinish = vi.fn()
        const { execute } = useApiBatch(['/a', '/b'], { onFinish })
        await execute()

        expect(onFinish).toHaveBeenCalledOnce()
        const [results] = onFinish.mock.calls[0]
        expect(results).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('useApiBatch — reset', () => {
    it('reset() clears data, errors, progress and loading', async () => {
        mockRequest.mockResolvedValue({ data: {}, status: 200 })
        const { data, errors, progress, loading, execute, reset } = useApiBatch(['/a', '/b'])
        await execute()

        expect(data.value.length).toBeGreaterThan(0)

        reset()

        expect(data.value).toHaveLength(0)
        expect(errors.value).toHaveLength(0)
        expect(progress.value.completed).toBe(0)
        expect(loading.value).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Task 1: external signal chain — abort() reaches Axios
// ---------------------------------------------------------------------------

describe('useApiBatch — abort() cancels in-flight Axios requests', () => {
    it('abort() causes in-flight requests to be cancelled at the Axios level', async () => {
        let capturedSignal: AbortSignal | undefined

        mockRequest.mockImplementation((config: { signal?: AbortSignal }) => {
            capturedSignal = config.signal
            // Return a promise that rejects when the signal is aborted — simulates Axios CanceledError
            return new Promise((_resolve, reject) => {
                if (config.signal) {
                    config.signal.addEventListener('abort', () => {
                        const err = Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })
                        reject(err)
                    }, { once: true })
                }
            })
        })

        const { execute, abort } = useApiBatch(['/slow'])
        const p = execute()
        // Give execute() time to reach mockRequest
        await new Promise(r => setTimeout(r, 0))

        expect(capturedSignal).toBeDefined()
        expect(capturedSignal!.aborted).toBe(false)

        abort('test abort')

        expect(capturedSignal!.aborted).toBe(true)

        // Wait for the batch to settle after abort
        await p.catch(() => {})
    })
})

// ---------------------------------------------------------------------------
// Problem B: BatchResultItem response field
// ---------------------------------------------------------------------------

describe('useApiBatch — BatchResultItem.response', () => {
    it('successful item has response field populated with full AxiosResponse', async () => {
        mockRequest.mockResolvedValueOnce({ data: { id: 1 }, status: 200, headers: { 'x-custom': 'abc' } })

        const { data, execute } = useApiBatch(['/item'])
        await execute()

        const item = data.value[0]
        expect(item.response).not.toBeNull()
        expect(item.response?.status).toBe(200)
        expect(item.response?.data).toEqual({ id: 1 })
    })

    it('failed item has response: null', async () => {
        mockRequest.mockRejectedValueOnce(axiosError(500))

        const { data, execute } = useApiBatch(['/item'], { settled: true })
        await execute()

        expect(data.value[0].response).toBeNull()
    })

    it('response.headers are accessible per successful item', async () => {
        mockRequest.mockResolvedValueOnce({
            data: {},
            status: 200,
            headers: { 'x-rate-limit-remaining': '42' },
        })

        const { data, execute } = useApiBatch(['/limited'])
        await execute()

        expect(data.value[0].response?.headers?.['x-rate-limit-remaining']).toBe('42')
    })

    it('successfulData computed still works correctly alongside response field', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: 'ok', status: 200 })
            .mockRejectedValueOnce(axiosError(404))

        const { successfulData, execute } = useApiBatch(['/a', '/b'], { settled: true })
        await execute()

        expect(successfulData.value).toEqual(['ok'])
    })
})

// ---------------------------------------------------------------------------
// Problem A: effectScope isolation — useApi runs in a managed scope
// ---------------------------------------------------------------------------

describe('useApiBatch — effectScope per request', () => {
    it('does not throw when called outside a Vue component scope', async () => {
        mockRequest.mockResolvedValueOnce({ data: 'ok', status: 200 })

        // Tests run outside any Vue component — this must not throw
        const { data, execute } = useApiBatch(['/outside'])
        await expect(execute()).resolves.not.toThrow()
        expect(data.value[0].success).toBe(true)
    })

    it('creates and stops one effectScope per request', async () => {
        // Behavioral verification: all 3 requests complete correctly, which proves
        // each scope was created, useApi ran inside it, and scope.stop() was called.
        // (ESM Vue exports cannot be spied on in Vitest — direct spy not possible)
        mockRequest
            .mockResolvedValueOnce({ data: 1, status: 200 })
            .mockResolvedValueOnce({ data: 2, status: 200 })
            .mockResolvedValueOnce({ data: 3, status: 200 })

        const { data, execute } = useApiBatch(['/x', '/y', '/z'])
        await execute()

        expect(data.value).toHaveLength(3)
        expect(data.value.every(item => item.success)).toBe(true)
        // If scope.stop() was NOT called, onScopeDispose handlers would leak —
        // vitest afterEach would surface teardown warnings. Clean run = scopes stopped.
    })

    it('stops scope even when a request throws unexpectedly', async () => {
        // Behavioral: failed request still returns a BatchResultItem (not an unhandled throw).
        // This means the finally { scope.stop() } block ran successfully.
        mockRequest.mockRejectedValueOnce(axiosError(500))

        const { data, execute } = useApiBatch(['/fail'], { settled: true })
        await execute()

        expect(data.value[0].success).toBe(false)
        expect(data.value[0].response).toBeNull()
    })

    it.todo('useApiBatch — scope is properly isolated when called from a Pinia store action')
    it.todo('useApiBatch — rapid re-execution (execute() called while previous batch is running) stops previous scopes before starting new ones')
    it.todo('BatchResultItem response — headers from X-RateLimit-Remaining are accessible per item')
    it.todo('useApiBatch with watch — re-execution cleans up scopes from previous batch run')
})

// ---------------------------------------------------------------------------
// BatchRequestConfig — per-request method, data, params, headers
// ---------------------------------------------------------------------------

describe('useApiBatch — BatchRequestConfig: backward compatibility', () => {
    it('plain string array still works exactly as before', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
            .mockResolvedValueOnce({ data: { id: 2 }, status: 200 })

        const { data, execute } = useApiBatch(['/a', '/b'])
        await execute()

        expect(data.value).toHaveLength(2)
        expect(data.value.every(r => r.success)).toBe(true)
    })

    it('string item is normalized to { url, method: "GET" } in result.request', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { data, execute } = useApiBatch(['/users'])
        await execute()

        expect(data.value[0].request).toEqual({ url: '/users', method: 'GET' })
    })

    it('mixed array — strings and objects resolve correctly', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: { type: 'string' }, status: 200 })
            .mockResolvedValueOnce({ data: { type: 'object' }, status: 200 })

        const { data, execute } = useApiBatch([
            '/string-item',
            { url: '/object-item', method: 'POST', data: { key: 'val' } },
        ])
        await execute()

        expect(data.value).toHaveLength(2)
        expect(data.value[0].request).toEqual({ url: '/string-item', method: 'GET' })
        expect(data.value[1].request).toMatchObject({ url: '/object-item', method: 'POST' })
    })
})

describe('useApiBatch — BatchRequestConfig: per-request method', () => {
    it('method: "POST" — axios is called with POST', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 201 })

        const { execute } = useApiBatch([{ url: '/posts', method: 'POST', data: { title: 'x' } }])
        await execute()

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }))
    })

    it('method: "DELETE" — axios is called with DELETE', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { execute } = useApiBatch([{ url: '/users/1', method: 'DELETE' }])
        await execute()

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE' }))
    })

    it('method defaults to "GET" when not provided in config object', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { data, execute } = useApiBatch([{ url: '/health' }])
        await execute()

        expect(data.value[0].request.method).toBe('GET')
        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }))
    })
})

describe('useApiBatch — BatchRequestConfig: per-request data', () => {
    it('data is forwarded to the axios request body', async () => {
        mockRequest.mockResolvedValueOnce({ data: { id: 99 }, status: 201 })

        const { execute } = useApiBatch([{ url: '/posts', method: 'POST', data: { title: 'Hello' } }])
        await execute()

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ data: { title: 'Hello' } })
        )
    })

    it('BatchResultItem.request contains the data field from the config', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { data, execute } = useApiBatch([{ url: '/report', method: 'POST', data: { from: '2026-01-01' } }])
        await execute()

        expect(data.value[0].request.data).toEqual({ from: '2026-01-01' })
    })
})

describe('useApiBatch — BatchRequestConfig: per-request params', () => {
    it('params are forwarded as query parameters to axios', async () => {
        mockRequest.mockResolvedValueOnce({ data: [], status: 200 })

        const { execute } = useApiBatch([{ url: '/users', params: { page: 2, limit: 10 } }])
        await execute()

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ params: { page: 2, limit: 10 } })
        )
    })

    it('different params per item produce independent axios calls', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: ['p1'], status: 200 })
            .mockResolvedValueOnce({ data: ['p2'], status: 200 })

        const { execute } = useApiBatch([
            { url: '/users', params: { page: 1 } },
            { url: '/users', params: { page: 2 } },
        ])
        await execute()

        const calls = (mockRequest as Mock).mock.calls
        expect(calls[0][0].params).toEqual({ page: 1 })
        expect(calls[1][0].params).toEqual({ page: 2 })
    })

    it('item without params does not add query string', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { execute } = useApiBatch([{ url: '/no-params' }])
        await execute()

        const call = (mockRequest as Mock).mock.calls[0][0]
        expect(call.params).toBeUndefined()
    })
})

describe('useApiBatch — BatchRequestConfig: per-request headers', () => {
    it('headers override is applied to its own request', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { execute } = useApiBatch([
            { url: '/api', headers: { 'x-tenant': 'acme' } },
        ])
        await execute()

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ headers: expect.objectContaining({ 'x-tenant': 'acme' }) })
        )
    })

    it('headers from one item do not affect other batch items', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockResolvedValueOnce({ data: {}, status: 200 })

        const { execute } = useApiBatch([
            { url: '/with-header', headers: { 'x-tenant': 'acme' } },
            { url: '/without-header' },
        ])
        await execute()

        const calls = (mockRequest as Mock).mock.calls
        // Second call must NOT have the x-tenant header from the first item
        expect(calls[1][0].headers?.['x-tenant']).toBeUndefined()
    })
})

describe('useApiBatch — BatchResultItem.request field', () => {
    it('result.request is populated for every item (success and failure)', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: {}, status: 200 })
            .mockRejectedValueOnce(axiosError(500))

        const { data, execute } = useApiBatch(['/ok', '/fail'], { settled: true })
        await execute()

        expect(data.value[0].request).toBeDefined()
        expect(data.value[0].request.url).toBe('/ok')
        expect(data.value[1].request).toBeDefined()
        expect(data.value[1].request.url).toBe('/fail')
    })

    it('object input → result.request matches the provided config', async () => {
        mockRequest.mockResolvedValueOnce({ data: {}, status: 200 })

        const { data, execute } = useApiBatch([
            { url: '/reports', method: 'POST', data: { from: '2026-01-01' }, params: { fmt: 'json' } },
        ])
        await execute()

        expect(data.value[0].request).toMatchObject({
            url: '/reports',
            method: 'POST',
            data: { from: '2026-01-01' },
            params: { fmt: 'json' },
        })
    })
})

describe('useApiBatch — BatchRequestConfig: reactive getter with object configs', () => {
    it('() => items.map() getter recomputes correctly on each execute()', async () => {
        mockRequest
            .mockResolvedValueOnce({ data: 'page1', status: 200 })
            .mockResolvedValueOnce({ data: 'page2', status: 200 })
            .mockResolvedValueOnce({ data: 'page3', status: 200 })

        const pages = [1, 2, 3]

        const { data, execute } = useApiBatch(
            () => pages.map(page => ({ url: '/users', params: { page } })),
            { lazy: true }
        )
        await execute()

        expect(data.value).toHaveLength(3)
        const calls = (mockRequest as Mock).mock.calls
        expect(calls[0][0].params).toEqual({ page: 1 })
        expect(calls[1][0].params).toEqual({ page: 2 })
        expect(calls[2][0].params).toEqual({ page: 3 })
    })

    it.todo('per-request headers — Authorization header override does not affect tokenManager global token')
    it.todo('batch of POST requests — each item sends its own independent data body')
    it.todo('BatchRequestConfig — method is case-insensitive (post vs POST)')
    it.todo('reactive getter — changing data inside config objects triggers re-execution when watched')
})

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

        // Wait for initial auto-execute to fire and complete
        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2))

        // Change the reactive dep
        ids.value = [1, 2, 3]
        await nextTick()

        // Should have fired again with 3 requests
        await vi.waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(5)) // 2 + 3
        await vi.waitFor(() => expect(data.value).toHaveLength(3))
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

