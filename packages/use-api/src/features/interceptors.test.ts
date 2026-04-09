import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { setupInterceptors } from './interceptors'
import { tokenManager } from './tokenManager'
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
