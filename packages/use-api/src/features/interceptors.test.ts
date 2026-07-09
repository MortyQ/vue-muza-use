import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { setupInterceptors } from './interceptors'
import { tokenManager } from './tokenManager'
import { devtoolsBridge, __devtoolsInternals } from '../devtools'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

type MockAxiosInstance = AxiosInstance & Mock & {
    post: Mock;
    request: Mock;
    interceptors: {
        request: { use: Mock };
        response: { use: Mock };
    }
}

// Helper to create mocked axios instance
function createMockInstance(): MockAxiosInstance {
    const instance = {
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        },
        defaults: { headers: { common: {} } },
        post: vi.fn(),
        // mock the call itself
        request: vi.fn()
    }
    // Make instance callable to simulate axios(config)
    const callable = vi.fn() as unknown as MockAxiosInstance
    Object.assign(callable, instance)
    return callable
}

describe('Interceptors', () => {
    let mockInstance: MockAxiosInstance
    let requestInterceptor: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
    let errorInterceptor: (error: unknown) => Promise<unknown>

    beforeEach(() => {
        vi.clearAllMocks()
        tokenManager.clearTokens()

        mockInstance = createMockInstance()
        setupInterceptors(mockInstance, { refreshUrl: '/refresh' })

        // Capture interceptors
        // request.use(success, error) - get the success handler (first arg)
        requestInterceptor = (mockInstance.interceptors.request.use as Mock).mock.calls[0][0]

        // response.use(success, error) - get the error handler (second arg)
        errorInterceptor = (mockInstance.interceptors.response.use as Mock).mock.calls[0][1]
    })

    it('should inject token into headers', () => {
        tokenManager.setTokens({ accessToken: 'valid-token' })

        const config = { headers: { set: vi.fn() } } as unknown as InternalAxiosRequestConfig

        requestInterceptor(config)

        expect(config.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer valid-token')
    })

    it('should NOT inject token if authMode is public', () => {
        tokenManager.setTokens({ accessToken: 'valid-token' })

        const config = { headers: { set: vi.fn() }, authMode: 'public' } as unknown as InternalAxiosRequestConfig

        requestInterceptor(config)

        expect(config.headers.set).not.toHaveBeenCalled()
    })

    it('should refresh token on 401', async () => {
        tokenManager.setTokens({ accessToken: 'expired' })

        const error = {
            config: { headers: { set: vi.fn() }, url: '/api', _retry: false },
            response: { status: 401 }
        }

        // Mock refresh success
        mockInstance.post.mockResolvedValue({
            data: { accessToken: 'new-token' }
        });

        // Setup mockInstance to return success on retry
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        await errorInterceptor(error)

        expect(mockInstance.post).toHaveBeenCalledWith('/refresh', {}, expect.objectContaining({ authMode: 'public' }))
        expect(tokenManager.getAccessToken()).toBe('new-token')
        expect(mockInstance).toHaveBeenCalled() // The retry called
    })

    it('should queue requests while refreshing', async () => {
         tokenManager.setTokens({ accessToken: 'expired' })

         const error1 = {
             config: { headers: { set: vi.fn() }, url: '/api/1', _retry: false },
             response: { status: 401 }
         }
         const error2 = {
             config: { headers: { set: vi.fn() }, url: '/api/2', _retry: false },
             response: { status: 401 }
         }

         let resolveRefresh: (value: unknown) => void = () => {}
         const refreshPromise = new Promise(resolve => resolveRefresh = resolve)

         mockInstance.post.mockReturnValue(refreshPromise);
         (mockInstance as unknown as Mock).mockResolvedValue('success')

         // Trigger first 401 -> starts refresh
         const p1 = errorInterceptor(error1)

         // Trigger second 401 -> should be queued
         const p2 = errorInterceptor(error2)

         // Finish refresh
         resolveRefresh({ data: { accessToken: 'refreshed' } })

         await Promise.all([p1, p2])

         expect(mockInstance.post).toHaveBeenCalledTimes(1) // Only 1 refresh
         expect(mockInstance).toHaveBeenCalledTimes(2) // 2 retries
    })

    it('should logout on refresh failure', async () => {
        tokenManager.setTokens({ accessToken: 'expired' })

        const error = {
            config: { headers: { set: vi.fn() }, url: '/api', _retry: false },
            response: { status: 401 }
        }

        mockInstance.post.mockRejectedValue(new Error('Refresh failed'))
        const onRefreshFailed = vi.fn()

        // Re-setup to capture options
        vi.clearAllMocks()
        mockInstance = createMockInstance()
        setupInterceptors(mockInstance, {
            refreshUrl: '/refresh',
            onTokenRefreshFailed: onRefreshFailed
        })
        errorInterceptor = (mockInstance.interceptors.response.use as Mock).mock.calls[0][1]

        try {
            await errorInterceptor(error)
        } catch (e) {
            // expected
        }

        expect(tokenManager.getAccessToken()).toBeNull()
        expect(onRefreshFailed).toHaveBeenCalled()
    })
})


// ---------------------------------------------------------------------------
// Helper — reusable per-test setup (used by new describe blocks below)
// ---------------------------------------------------------------------------

function buildSetup(options: Parameters<typeof setupInterceptors>[1] = {}) {
    const instance = createMockInstance()
    setupInterceptors(instance, { refreshUrl: '/refresh', ...options })
    const requestInterceptor = (instance.interceptors.request.use as Mock).mock.calls[0][0]
    const errorInterceptor   = (instance.interceptors.response.use as Mock).mock.calls[0][1]
    return { instance, requestInterceptor, errorInterceptor }
}

function make401(url = '/api', extra: Record<string, unknown> = {}) {
    return {
        config: { headers: { set: vi.fn(), delete: vi.fn() }, url, _retry: false, ...extra },
        response: { status: 401 },
    }
}

// ---------------------------------------------------------------------------
// Closure isolation — two independent instances must not share state
// ---------------------------------------------------------------------------

describe('Interceptors — closure isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        tokenManager.clearTokens()
        tokenManager.setTokens({ accessToken: 'expired' })
    })

    it('two instances each start their own refresh on simultaneous 401s', async () => {
        const { instance: instA, errorInterceptor: errorA } = buildSetup()
        const { instance: instB, errorInterceptor: errorB } = buildSetup()

        let resolveA!: (v: unknown) => void
        let resolveB!: (v: unknown) => void
        instA.post.mockReturnValue(new Promise(r => { resolveA = r }))
        instB.post.mockReturnValue(new Promise(r => { resolveB = r }));
        (instA as unknown as Mock).mockResolvedValue('retry-A');
        (instB as unknown as Mock).mockResolvedValue('retry-B')

        // Both instances receive a 401 — each should start its own refresh
        const pA = errorA(make401('/a'))
        const pB = errorB(make401('/b'))

        // Both should have initiated their own POST to /refresh independently
        expect(instA.post).toHaveBeenCalledTimes(1)
        expect(instB.post).toHaveBeenCalledTimes(1)

        resolveA({ data: { accessToken: 'token-A' } })
        resolveB({ data: { accessToken: 'token-B' } })
        await Promise.all([pA, pB])

        // Each instance retried its own original request exactly once
        expect(instA).toHaveBeenCalledTimes(1)
        expect(instB).toHaveBeenCalledTimes(1)
    })

    it('instance A refresh success does not affect instance B requests', async () => {
        const { instance: instA, errorInterceptor: errorA } = buildSetup()
        const { instance: instB, errorInterceptor: errorB } = buildSetup()

        let resolveA!: (v: unknown) => void
        instA.post.mockReturnValue(new Promise(r => { resolveA = r }))
        instB.post.mockResolvedValue({ data: { accessToken: 'token-B' } });
        (instA as unknown as Mock).mockResolvedValue('retry-A');
        (instB as unknown as Mock).mockResolvedValue('retry-B')

        const pA = errorA(make401('/a'))
        const pB = errorB(make401('/b'))

        resolveA({ data: { accessToken: 'token-A' } })
        await Promise.all([pA, pB])

        // Verify neither instance "helped" the other: each retried its own original request
        expect(instA).toHaveBeenCalledTimes(1)
        expect(instB).toHaveBeenCalledTimes(1)
    })

    it('instance A refresh failure does not reject instance B queued requests', async () => {
        const { instance: instA, errorInterceptor: errorA } = buildSetup()
        const { instance: instB, errorInterceptor: errorB } = buildSetup()

        const refreshError = new Error('A refresh failed')
        instA.post.mockRejectedValue(refreshError)
        instB.post.mockResolvedValue({ data: { accessToken: 'token-B' } });
        (instB as unknown as Mock).mockResolvedValue('retry-B')

        const pA = errorA(make401('/a'))
        const pB = errorB(make401('/b'))

        // pA should reject (A's refresh failed), pB should resolve (B succeeded)
        await expect(pA).rejects.toBe(refreshError)
        await expect(pB).resolves.toBe('retry-B')
    })
})

// ---------------------------------------------------------------------------
// Queue behaviour — verify still correct after closure move
// ---------------------------------------------------------------------------

describe('Interceptors — queue behaviour', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        tokenManager.clearTokens()
        tokenManager.setTokens({ accessToken: 'expired' })
    })

    it('three concurrent 401s → single refresh → all three original requests retried', async () => {
        const { instance, errorInterceptor } = buildSetup()

        let resolveRefresh!: (v: unknown) => void
        instance.post.mockReturnValue(new Promise(r => { resolveRefresh = r }));
        (instance as unknown as Mock).mockResolvedValue('success')

        const p1 = errorInterceptor(make401('/api/1'))
        const p2 = errorInterceptor(make401('/api/2'))
        const p3 = errorInterceptor(make401('/api/3'))

        resolveRefresh({ data: { accessToken: 'fresh-token' } })
        await Promise.all([p1, p2, p3])

        expect(instance.post).toHaveBeenCalledTimes(1) // single refresh
        expect(instance).toHaveBeenCalledTimes(3)      // three retries
    })

    it('authMode: public 401 does NOT trigger a refresh POST', async () => {
        const { instance, errorInterceptor } = buildSetup()

        const error401public = make401('/public-api', { authMode: 'public' })

        await expect(errorInterceptor(error401public)).rejects.toBeDefined()

        expect(instance.post).not.toHaveBeenCalled()
    })

    it('same 401→refresh→retry cycle works identically on repeated calls (no state leakage)', async () => {
        // Run the full cycle twice on the SAME instance — state must reset cleanly.
        const { instance, errorInterceptor } = buildSetup()

        for (let run = 0; run < 2; run++) {
            vi.clearAllMocks()
            tokenManager.setTokens({ accessToken: 'expired' })
            instance.post.mockResolvedValue({ data: { accessToken: `fresh-run-${run}` } });
            (instance as unknown as Mock).mockResolvedValue(`retried-run-${run}`)

            const error = make401('/api')
            // Each iteration must successfully refresh and retry
            await expect(errorInterceptor(error)).resolves.toBe(`retried-run-${run}`)
            expect(instance.post).toHaveBeenCalledTimes(1)
            expect(instance).toHaveBeenCalledTimes(1)
        }
    })
})

// ---------------------------------------------------------------------------
// Known limitations (it.todo)
// ---------------------------------------------------------------------------

describe('Interceptors — known limitations (todo)', () => {
    it.todo('two instances with different refreshUrls — each uses its own refreshUrl independently')
    it.todo('two instances with different onTokenRefreshFailed — each callback fires for its own instance only')
    it.todo('isRefreshing resets to false after refresh failure so subsequent 401s trigger a new refresh attempt')
})

// ---------------------------------------------------------------------------
// Devtools — refresh request visibility
// ---------------------------------------------------------------------------

describe('Interceptors — devtools refresh request visibility', () => {
    let mockInstance: MockAxiosInstance
    let errorInterceptor: (error: unknown) => Promise<unknown>

    beforeEach(() => {
        vi.clearAllMocks()
        __devtoolsInternals().reset()
        tokenManager.clearTokens()

        mockInstance = createMockInstance()
        setupInterceptors(mockInstance, { refreshUrl: '/refresh' })
        errorInterceptor = (mockInstance.interceptors.response.use as Mock).mock.calls[0][1]
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('records the refresh POST as a standalone request on success', async () => {
        __devtoolsInternals().setExpected(true)
        const startSpy = vi.spyOn(devtoolsBridge, 'onRequestStart')
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({ data: { accessToken: 'new-a', refreshToken: 'new-r' }, status: 200 });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: '/refresh',
            method: 'POST',
            instanceId: null,
            status: 'pending',
        }))
        expect(endSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'success', statusCode: 200 }),
        )
    })

    it('redacts token fields in the recorded refresh response, leaving other fields untouched', async () => {
        __devtoolsInternals().setExpected(true)
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({
            data: { accessToken: 'new-a', refreshToken: 'new-r', expiresIn: 3600 },
            status: 200,
        });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        const result = endSpy.mock.calls[0][1]
        expect(result).toMatchObject({
            response: { accessToken: '•••redacted•••', refreshToken: '•••redacted•••', expiresIn: 3600 },
        })
    })

    it('redacts nested token fields (e.g. a wrapped extractTokens response shape)', async () => {
        __devtoolsInternals().setExpected(true)
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({
            // top-level accessToken satisfies the (no-extractTokens) refresh flow;
            // `result` simulates a nested shape a consumer's extractTokens might read from
            data: { accessToken: 'flat-a', result: { accessToken: 'nested-a', refreshToken: 'nested-r' }, requestId: 'r-1' },
            status: 200,
        });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        const result = endSpy.mock.calls[0][1]
        expect(result).toMatchObject({
            response: {
                accessToken: '•••redacted•••',
                result: { accessToken: '•••redacted•••', refreshToken: '•••redacted•••' },
                requestId: 'r-1',
            },
        })
    })

    it('records an error entry when the refresh itself fails, with details redacted', async () => {
        __devtoolsInternals().setExpected(true)
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockRejectedValue(
            Object.assign(new Error('refresh failed'), {
                response: { status: 401, data: { accessToken: 'stale-a', message: 'expired' } },
                isAxiosError: true,
            }),
        )

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await expect(errorInterceptor(error)).rejects.toBeDefined()

        expect(endSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                status: 'error',
                error: expect.objectContaining({
                    details: expect.objectContaining({ accessToken: '•••redacted•••', message: 'expired' }),
                }),
            }),
        )
    })

    it('does not touch the bridge when devtools is not expected', async () => {
        // reset() left devtoolsExpected = false — production default
        const startSpy = vi.spyOn(devtoolsBridge, 'onRequestStart')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({ data: { accessToken: 'new-a' }, status: 200 });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        expect(startSpy).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Devtools — 401 retry visibility (onRequestAuthRetry)
// ---------------------------------------------------------------------------

describe('Interceptors — devtools 401 retry visibility', () => {
    let mockInstance: MockAxiosInstance
    let errorInterceptor: (error: unknown) => Promise<unknown>

    beforeEach(() => {
        vi.clearAllMocks()
        __devtoolsInternals().reset()
        tokenManager.clearTokens()

        mockInstance = createMockInstance()
        setupInterceptors(mockInstance, { refreshUrl: '/refresh' })
        errorInterceptor = (mockInstance.interceptors.response.use as Mock).mock.calls[0][1]
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('flags the original request when the refresh succeeds and the request is retried', async () => {
        __devtoolsInternals().setExpected(true)
        const retrySpy = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({ data: { accessToken: 'new-a' }, status: 200 });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = {
            config: { headers: { set: vi.fn() }, url: '/api', _retry: false, _devtoolsRequestId: 'req_42' },
            response: { status: 401 },
        }
        await errorInterceptor(error)

        expect(retrySpy).toHaveBeenCalledTimes(1)
        expect(retrySpy).toHaveBeenCalledWith('req_42')
    })

    it('flags each queued request when a shared refresh succeeds', async () => {
        __devtoolsInternals().setExpected(true)
        const retrySpy = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')

        tokenManager.setTokens({ accessToken: 'expired' })
        let resolveRefresh!: (v: unknown) => void
        mockInstance.post.mockReturnValue(new Promise(r => { resolveRefresh = r }));
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const makeError = (id: string) => ({
            config: { headers: { set: vi.fn() }, url: `/api/${id}`, _retry: false, _devtoolsRequestId: id },
            response: { status: 401 },
        })
        const p1 = errorInterceptor(makeError('req_1'))
        const p2 = errorInterceptor(makeError('req_2'))
        const p3 = errorInterceptor(makeError('req_3'))

        resolveRefresh({ data: { accessToken: 'fresh' }, status: 200 })
        await Promise.all([p1, p2, p3])

        expect(retrySpy).toHaveBeenCalledTimes(3)
        expect(retrySpy).toHaveBeenCalledWith('req_1')
        expect(retrySpy).toHaveBeenCalledWith('req_2')
        expect(retrySpy).toHaveBeenCalledWith('req_3')
    })

    it('does NOT flag the request when the refresh fails (record must stay a plain 401 error)', async () => {
        __devtoolsInternals().setExpected(true)
        const retrySpy = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockRejectedValue(new Error('refresh failed'))

        const error = {
            config: { headers: { set: vi.fn() }, url: '/api', _retry: false, _devtoolsRequestId: 'req_42' },
            response: { status: 401 },
        }
        await expect(errorInterceptor(error)).rejects.toBeDefined()

        expect(retrySpy).not.toHaveBeenCalled()
    })

    it('does NOT flag when devtools is not expected', async () => {
        // reset() left devtoolsExpected = false — production default
        const retrySpy = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({ data: { accessToken: 'new-a' }, status: 200 });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = {
            config: { headers: { set: vi.fn() }, url: '/api', _retry: false, _devtoolsRequestId: 'req_42' },
            response: { status: 401 },
        }
        await errorInterceptor(error)

        expect(retrySpy).not.toHaveBeenCalled()
    })

    it('does NOT flag when the request carries no _devtoolsRequestId', async () => {
        __devtoolsInternals().setExpected(true)
        const retrySpy = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({ data: { accessToken: 'new-a' }, status: 200 });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        expect(retrySpy).not.toHaveBeenCalled()
    })

    it('includes request/response headers on the recorded refresh success', async () => {
        __devtoolsInternals().setExpected(true)
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')

        tokenManager.setTokens({ accessToken: 'expired' })
        mockInstance.post.mockResolvedValue({
            data: { accessToken: 'new-a' },
            status: 200,
            headers: { 'content-type': 'application/json' },
            config: { headers: { accept: 'application/json' } },
        });
        (mockInstance as unknown as Mock).mockResolvedValue('success')

        const error = { config: { headers: { set: vi.fn() }, url: '/api', _retry: false }, response: { status: 401 } }
        await errorInterceptor(error)

        expect(endSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                requestHeaders: { accept: 'application/json' },
                responseHeaders: { 'content-type': 'application/json' },
            }),
        )
    })
})

// ---------------------------------------------------------------------------
// Refresh endpoint matching — exact/suffix match, not substring
// ---------------------------------------------------------------------------

describe('refresh endpoint matching', () => {
    let mockInstance2: MockAxiosInstance
    let errorInterceptor2: (error: unknown) => Promise<unknown>

    beforeEach(() => {
        mockInstance2 = createMockInstance()
        setupInterceptors(mockInstance2, { refreshUrl: '/auth/refresh' })
        errorInterceptor2 = (mockInstance2.interceptors.response.use as Mock).mock.calls[0][1]
    })

    it('does NOT treat /auth/refresh-devices as the refresh endpoint', async () => {
        tokenManager.setTokens({ accessToken: 'old-token' })
        mockInstance2.post.mockResolvedValue({ data: { accessToken: 'new-token' } });
        (mockInstance2 as unknown as Mock).mockResolvedValue('success')

        const error = {
            config: { headers: { set: vi.fn() }, url: '/auth/refresh-devices', _retry: false },
            response: { status: 401 },
        }

        await errorInterceptor2(error)

        // Should have gone down the NORMAL refresh path (POST to the refresh endpoint),
        // not the "refresh itself failed" short-circuit.
        expect(mockInstance2.post).toHaveBeenCalledWith('/auth/refresh', expect.anything(), expect.anything())
    })

    it('still detects the exact refresh URL (with query string) as the refresh endpoint', async () => {
        const clearSpy = vi.spyOn(tokenManager, 'clearTokens')
        tokenManager.setTokens({ accessToken: 'old-token' })

        const error = {
            config: { headers: { set: vi.fn() }, url: '/auth/refresh?device=web', _retry: false },
            response: { status: 401 },
        }

        await expect(errorInterceptor2(error)).rejects.toBeDefined()

        // Refresh endpoint itself failed -> tokens cleared, no second refresh POST attempted
        expect(clearSpy).toHaveBeenCalled()
        expect(mockInstance2.post).not.toHaveBeenCalled()
        clearSpy.mockRestore()
    })

    it('anchors on a "/" boundary even when refreshUrl is configured without a leading slash', async () => {
        const mockInstance3 = createMockInstance()
        setupInterceptors(mockInstance3, { refreshUrl: 'refresh' })
        const errorInterceptor3 = (mockInstance3.interceptors.response.use as Mock).mock.calls[0][1]

        tokenManager.setTokens({ accessToken: 'old-token' })
        mockInstance3.post.mockResolvedValue({ data: { accessToken: 'new-token' } });
        (mockInstance3 as unknown as Mock).mockResolvedValue('success')

        const error = {
            config: { headers: { set: vi.fn() }, url: '/my-refresh', _retry: false },
            response: { status: 401 },
        }

        await errorInterceptor3(error)

        // "/my-refresh" has no "/" boundary before "refresh" — a bare endsWith("refresh")
        // would wrongly match it; the "/" anchor must exclude it.
        expect(mockInstance3.post).toHaveBeenCalledWith('refresh', expect.anything(), expect.anything())
    })
})
