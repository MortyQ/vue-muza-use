/**
 * createAuthSession — core
 *
 * Covers the spec scenarios of use-api-auth-session that need no attached instance:
 *  - Session exposes the current token
 *  - Refresh is single-flight (concurrent callers, sequential refreshes)
 *  - Refresh transport is configurable (declarative + function, response without token)
 *  - Refresh failure ends the session
 *  - Session lifecycle events
 *  - Auth monitor parity (start / success / error)
 * plus storage configuration, a custom token store and devtools reporting.
 * Attached instances: authSession.attach.test.ts. Cross-tab: authSession.crossTab.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthSession } from '../../src/features/authSession'
import { tokenManager, TokenManager, LocalStorageTokenStorage, type TokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor, AuthEventType } from '../../src/features/monitor'
import { devtoolsBridge, __devtoolsInternals } from '../../src/devtools'
import { useGlobalFakeAdapter, fullUrl, deferred, type FakeHandler } from './authSession.fixtures'

let restoreAdapter: (() => void) | null = null

function backend(handler: FakeHandler) {
    const { adapter, restore } = useGlobalFakeAdapter(handler)
    restoreAdapter = restore
    return adapter
}

beforeEach(() => {
    tokenManager.setStorage(new LocalStorageTokenStorage())
    tokenManager.clearTokens()
    setAuthMonitor(() => {})
})

afterEach(() => {
    restoreAdapter?.()
    restoreAdapter = null
    __devtoolsInternals().reset()
    vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Session exposes the current token
// ---------------------------------------------------------------------------

describe('createAuthSession — token access', () => {
    it('sees a token written through tokenManager', () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }) })
        tokenManager.setTokens({ accessToken: 'a1' })

        expect(session.getAccessToken()).toBe('a1')
        expect(session.getAuthHeader()).toBe('Bearer a1')
    })

    it('returns null for token and header when nothing is stored', () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }) })

        expect(session.getAccessToken()).toBeNull()
        expect(session.getAuthHeader()).toBeNull()
    })

    it('writes refreshed tokens back so tokenManager sees them', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n1', refreshToken: 'r1' }) })
        await session.refresh()

        expect(tokenManager.getAccessToken()).toBe('n1')
        expect(tokenManager.getRefreshToken()).toBe('r1')
    })

    it('uses a custom token store instead of the singleton', async () => {
        const store: TokenStorage & { access: string | null } = {
            access: 'own-token',
            getAccessToken() { return this.access },
            getRefreshToken: () => null,
            setTokens(tokens) { this.access = tokens.accessToken },
            clearTokens() { this.access = null },
            getTokenExpiresAt: () => null,
            isTokenExpired: () => false,
        }
        tokenManager.setTokens({ accessToken: 'global-token' })
        const session = createAuthSession({
            refresh: async () => ({ accessToken: 'own-new' }),
            tokens: new TokenManager(store),
        })

        expect(session.getAccessToken()).toBe('own-token')
        await session.refresh()
        expect(store.access).toBe('own-new')
        expect(tokenManager.getAccessToken()).toBe('global-token')
    })
})

// ---------------------------------------------------------------------------
// Storage configuration
// ---------------------------------------------------------------------------

describe('createAuthSession — storeRefreshToken', () => {
    it('leaves the token storage untouched when omitted', () => {
        const spy = vi.spyOn(tokenManager, 'setStorage')
        createAuthSession({ refresh: async () => ({ accessToken: 'x' }) })
        expect(spy).not.toHaveBeenCalled()
    })

    it('storeRefreshToken: false keeps only the access token', () => {
        createAuthSession({ refresh: async () => ({ accessToken: 'x' }), storeRefreshToken: false })
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(tokenManager.getAccessToken()).toBe('a')
        expect(tokenManager.getRefreshToken()).toBeNull()
    })

    it('storeRefreshToken: true keeps both tokens', () => {
        createAuthSession({ refresh: async () => ({ accessToken: 'x' }), storeRefreshToken: true })
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(tokenManager.getRefreshToken()).toBe('r')
    })
})

// ---------------------------------------------------------------------------
// Refresh is single-flight
// ---------------------------------------------------------------------------

describe('createAuthSession — single-flight refresh', () => {
    it('three concurrent callers share one transport call and one token', async () => {
        const gate = deferred<{ accessToken: string }>()
        const transport = vi.fn(() => gate.promise)
        const session = createAuthSession({ refresh: transport })

        const p1 = session.refresh()
        const p2 = session.refresh()
        const p3 = session.refresh()
        expect(session.isRefreshing).toBe(true)

        gate.resolve({ accessToken: 'shared' })
        await expect(Promise.all([p1, p2, p3])).resolves.toEqual(['shared', 'shared', 'shared'])
        expect(transport).toHaveBeenCalledTimes(1)
        expect(session.isRefreshing).toBe(false)
    })

    it('performs a new refresh once the previous one has settled', async () => {
        let n = 0
        const transport = vi.fn(async () => ({ accessToken: `t${++n}` }))
        const session = createAuthSession({ refresh: transport })

        await expect(session.refresh()).resolves.toBe('t1')
        await expect(session.refresh()).resolves.toBe('t2')
        expect(transport).toHaveBeenCalledTimes(2)
    })

    it('starts a fresh refresh after a failed one', async () => {
        const transport = vi.fn()
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ accessToken: 'ok' })
        const session = createAuthSession({ refresh: transport })

        await expect(session.refresh()).rejects.toThrow('down')
        await expect(session.refresh()).resolves.toBe('ok')
        expect(transport).toHaveBeenCalledTimes(2)
    })
})

// ---------------------------------------------------------------------------
// Refresh transport is configurable
// ---------------------------------------------------------------------------

describe('createAuthSession — declarative transport', () => {
    it('POSTs to baseURL + url with credentials and no Authorization, storing access_token', async () => {
        tokenManager.setTokens({ accessToken: 'stale' })
        const adapter = backend(() => ({ data: { access_token: 'fresh' } }))
        const session = createAuthSession({
            refresh: { url: '/auth/refresh', baseURL: '/api', withCredentials: true },
        })

        await expect(session.refresh()).resolves.toBe('fresh')

        expect(adapter.calls).toHaveLength(1)
        const sent = adapter.calls[0]
        expect(sent.method).toBe('post')
        expect(fullUrl(sent)).toBe('/api/auth/refresh')
        expect(sent.withCredentials).toBe(true)
        expect(sent.headers.get('Authorization')).toBeUndefined()
        expect(tokenManager.getAccessToken()).toBe('fresh')
    })

    it('accepts the camelCase accessToken / refreshToken response shape', async () => {
        backend(() => ({ data: { accessToken: 'a2', refreshToken: 'r2' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })

        await session.refresh()
        expect(tokenManager.getAccessToken()).toBe('a2')
        expect(tokenManager.getRefreshToken()).toBe('r2')
    })

    it('sends credentials automatically when no refresh token is stored (legacy rule)', async () => {
        const adapter = backend(() => ({ data: { accessToken: 'a' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })

        await session.refresh()
        expect(adapter.calls[0].withCredentials).toBe(true)
    })

    it('omits credentials when a refresh token is stored and withCredentials is not set', async () => {
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })
        const adapter = backend(() => ({ data: { accessToken: 'b' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })

        await session.refresh()
        expect(adapter.calls[0].withCredentials).toBe(false)
    })

    it('sends a static or async payload as the JSON body', async () => {
        const adapter = backend(() => ({ data: { accessToken: 'a' } }))
        const staticSession = createAuthSession({ refresh: { url: '/r', payload: { deviceId: 'd1' } } })
        await staticSession.refresh()
        const asyncSession = createAuthSession({ refresh: { url: '/r', payload: async () => ({ ts: 42 }) } })
        await asyncSession.refresh()

        expect(JSON.parse(adapter.calls[0].data as string)).toEqual({ deviceId: 'd1' })
        expect(JSON.parse(adapter.calls[1].data as string)).toEqual({ ts: 42 })
    })

    it('uses extractTokens for a custom response shape', async () => {
        backend(() => ({ data: { auth: { jwt: 'custom' } } }))
        const session = createAuthSession({
            refresh: {
                url: '/r',
                extractTokens: (res) => ({ accessToken: (res.data as { auth: { jwt: string } }).auth.jwt }),
            },
        })

        await expect(session.refresh()).resolves.toBe('custom')
    })

    it('awaits onTokenRefreshed before waiters receive the token', async () => {
        backend(() => ({ data: { accessToken: 'a' } }))
        const order: string[] = []
        const hook = deferred<void>()
        const session = createAuthSession({
            refresh: {
                url: '/r',
                onTokenRefreshed: async (res) => {
                    order.push(`hook:${(res.data as { accessToken: string }).accessToken}`)
                    await hook.promise
                    order.push('hook-done')
                },
            },
        })

        const waiter = session.refresh().then(() => order.push('waiter'))
        await vi.waitFor(() => expect(order).toContain('hook:a'))
        expect(order).not.toContain('waiter')

        hook.resolve()
        await waiter
        expect(order).toEqual(['hook:a', 'hook-done', 'waiter'])
    })

    it('fails the refresh when onTokenRefreshed throws', async () => {
        backend(() => ({ data: { accessToken: 'a' } }))
        const session = createAuthSession({
            refresh: { url: '/r', onTokenRefreshed: () => { throw new Error('perm load failed') } },
        })

        await expect(session.refresh()).rejects.toThrow('perm load failed')
        expect(tokenManager.getAccessToken()).toBeNull()
    })

    it('treats a response without a token as a failure', async () => {
        backend(() => ({ data: { ok: true } }))
        const session = createAuthSession({ refresh: { url: '/r' } })

        await expect(session.refresh()).rejects.toThrow('No access token in refresh response')
    })

    it('treats a refresh-endpoint 401 as a failure without recursing', async () => {
        const adapter = backend(() => ({ status: 401, data: { message: 'expired' } }))
        const session = createAuthSession({ refresh: { url: '/r' } })

        await expect(session.refresh()).rejects.toMatchObject({ response: { status: 401 } })
        expect(adapter.calls).toHaveLength(1)
    })
})

describe('createAuthSession — function transport', () => {
    it('stores the token the function resolves with', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n1' }) })

        await session.refresh()
        expect(session.getAccessToken()).toBe('n1')
    })

    it('receives the stored refresh token and the stale access token', async () => {
        tokenManager.setTokens({ accessToken: 'old', refreshToken: 'r-old' })
        const transport = vi.fn(async () => ({ accessToken: 'new' }))
        const session = createAuthSession({ refresh: transport })

        await session.refresh()
        expect(transport).toHaveBeenCalledWith({ refreshToken: 'r-old', staleAccessToken: 'old' })
    })

    it('passes an explicit staleAccessToken through', async () => {
        tokenManager.setTokens({ accessToken: 'current' })
        const transport = vi.fn(async () => ({ accessToken: 'new' }))
        const session = createAuthSession({ refresh: transport })

        await session.refresh({ staleAccessToken: 'from-request' })
        expect(transport).toHaveBeenCalledWith(expect.objectContaining({ staleAccessToken: 'from-request' }))
    })

    it('treats a result without accessToken as a failure', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: '' }) })

        await expect(session.refresh()).rejects.toThrow('No access token in refresh response')
    })
})

// ---------------------------------------------------------------------------
// Refresh failure ends the session
// ---------------------------------------------------------------------------

describe('createAuthSession — failure', () => {
    it('rejects every waiter with the refresh error and clears the tokens', async () => {
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })
        const gate = deferred<{ accessToken: string }>()
        const session = createAuthSession({ refresh: () => gate.promise })
        const boom = new Error('refresh failed')

        const waiters = [session.refresh(), session.refresh(), session.refresh()]
        gate.reject(boom)

        for (const waiter of waiters) await expect(waiter).rejects.toBe(boom)
        expect(tokenManager.getAccessToken()).toBeNull()
        expect(tokenManager.getRefreshToken()).toBeNull()
    })

    it('emits refreshFailed once for a refresh awaited by five callers', async () => {
        const gate = deferred<{ accessToken: string }>()
        const session = createAuthSession({ refresh: () => gate.promise })
        const onFailed = vi.fn()
        session.on('refreshFailed', onFailed)

        const waiters = Array.from({ length: 5 }, () => session.refresh().catch(() => {}))
        const boom = new Error('x')
        gate.reject(boom)
        await Promise.all(waiters)

        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onFailed).toHaveBeenCalledWith({ error: boom })
    })
})

// ---------------------------------------------------------------------------
// Session lifecycle events
// ---------------------------------------------------------------------------

describe('createAuthSession — events', () => {
    it('calls every refreshed listener with the new token after it is stored', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n1' }) })
        const seenInStore: Array<string | null> = []
        const first = vi.fn(() => { seenInStore.push(tokenManager.getAccessToken()) })
        const second = vi.fn()
        session.on('refreshed', first)
        session.on('refreshed', second)

        await session.refresh()

        expect(first).toHaveBeenCalledWith({ accessToken: 'n1', response: null })
        expect(second).toHaveBeenCalledWith({ accessToken: 'n1', response: null })
        expect(seenInStore).toEqual(['n1'])
    })

    it('passes the raw response for the declarative transport', async () => {
        backend(() => ({ data: { accessToken: 'n2', user: { id: 7 } } }))
        const session = createAuthSession({ refresh: { url: '/r' } })
        const listener = vi.fn()
        session.on('refreshed', listener)

        await session.refresh()
        expect(listener.mock.calls[0][0].response.data).toEqual({ accessToken: 'n2', user: { id: 7 } })
    })

    it('emits refreshStart with the stale token', async () => {
        tokenManager.setTokens({ accessToken: 'stale-1' })
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n' }) })
        const listener = vi.fn()
        session.on('refreshStart', listener)

        await session.refresh()
        expect(listener).toHaveBeenCalledWith({ staleAccessToken: 'stale-1' })
    })

    it('does not call a listener after it unsubscribed', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n' }) })
        const listener = vi.fn()
        const off = session.on('refreshed', listener)

        await session.refresh()
        off()
        await session.refresh()
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('a throwing listener does not break the refresh or other listeners', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n' }) })
        const after = vi.fn()
        session.on('refreshed', () => { throw new Error('listener bug') })
        session.on('refreshed', after)

        const results = await Promise.all([session.refresh(), session.refresh()])

        expect(results).toEqual(['n', 'n'])
        expect(after).toHaveBeenCalledTimes(1)
        expect(errorSpy).toHaveBeenCalledWith('[vue-muza-use] auth session listener failed', expect.any(Error))
    })

    it('clear() clears the tokens and emits cleared', () => {
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n' }) })
        const onCleared = vi.fn(() => expect(tokenManager.getAccessToken()).toBeNull())
        session.on('cleared', onCleared)

        session.clear()

        expect(onCleared).toHaveBeenCalledWith({})
        expect(tokenManager.getAccessToken()).toBeNull()
        expect(tokenManager.getRefreshToken()).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Auth monitor parity
// ---------------------------------------------------------------------------

describe('createAuthSession — auth monitor', () => {
    it('reports start and success for a successful refresh', async () => {
        const monitor = vi.fn()
        setAuthMonitor(monitor)
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'n' }) })

        await session.refresh()

        expect(monitor.mock.calls.map(([type]) => type)).toEqual([
            AuthEventType.REFRESH_START,
            AuthEventType.REFRESH_SUCCESS,
        ])
    })

    it('reports start and error (with the error) for a failed refresh', async () => {
        const monitor = vi.fn()
        setAuthMonitor(monitor)
        const boom = new Error('no')
        const session = createAuthSession({ refresh: async () => { throw boom } })

        await session.refresh().catch(() => {})

        expect(monitor.mock.calls.map(([type]) => type)).toEqual([
            AuthEventType.REFRESH_START,
            AuthEventType.REFRESH_ERROR,
        ])
        expect(monitor.mock.calls[1][1]).toMatchObject({ error: boom })
    })
})

// ---------------------------------------------------------------------------
// Devtools — the declarative refresh is visible like the legacy one
// ---------------------------------------------------------------------------

describe('createAuthSession — devtools', () => {
    it('records the refresh POST with token fields redacted', async () => {
        __devtoolsInternals().setExpected(true)
        const startSpy = vi.spyOn(devtoolsBridge, 'onRequestStart')
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')
        backend(() => ({ data: { accessToken: 'secret-a', user: 'u' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh', payload: { refreshToken: 'x', device: 'd' } } })

        await session.refresh()

        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: '/auth/refresh',
            method: 'POST',
            instanceId: null,
            payload: { refreshToken: '•••redacted•••', device: 'd' },
        }))
        expect(endSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            status: 'success',
            statusCode: 200,
            response: { accessToken: '•••redacted•••', user: 'u' },
        }))
    })

    it('records an error entry when the refresh request fails', async () => {
        __devtoolsInternals().setExpected(true)
        const endSpy = vi.spyOn(devtoolsBridge, 'onRequestEnd')
        backend(() => ({ status: 500, data: { token: 'leak' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })

        await session.refresh().catch(() => {})

        expect(endSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            status: 'error',
            statusCode: 500,
        }))
        const result = endSpy.mock.calls[0][1] as { error: { details: unknown } }
        expect(JSON.stringify(result.error.details)).not.toContain('leak')
    })

    it('does not touch the bridge when devtools is not expected', async () => {
        const startSpy = vi.spyOn(devtoolsBridge, 'onRequestStart')
        backend(() => ({ data: { accessToken: 'a' } }))
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })

        await session.refresh()
        expect(startSpy).not.toHaveBeenCalled()
    })
})
