/**
 * createApiClient — the `authSession` option (new in 1.9)
 *
 * Neighbour of createInstance.test.ts (left unedited on purpose). Pins:
 *  - without `authSession` the global token storage is configured exactly as before
 *  - with `authSession` it is not, and the legacy interceptors are not installed
 *  - the instance defaults are the same in both paths
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApiClient } from '../../src/features/createInstance'
import { createAuthSession } from '../../src/features/authSession'
import { tokenManager, LocalStorageTokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor } from '../../src/features/monitor'

beforeEach(() => {
    tokenManager.setStorage(new LocalStorageTokenStorage())
    tokenManager.clearTokens()
    setAuthMonitor(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('createApiClient — without authSession (legacy path unchanged)', () => {
    it('configures global storage to keep only the access token for refreshWithCredentials: true', () => {
        createApiClient({ authOptions: { refreshWithCredentials: true } })
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(tokenManager.getAccessToken()).toBe('a')
        expect(tokenManager.getRefreshToken()).toBeNull()
    })

    it('configures global storage to keep both tokens by default', () => {
        const spy = vi.spyOn(tokenManager, 'setStorage')
        createApiClient()
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(spy).toHaveBeenCalledTimes(1)
        expect(tokenManager.getRefreshToken()).toBe('r')
    })

    it('installs one request and one response interceptor', () => {
        const client = createApiClient()
        expect(countHandlers(client.interceptors.request)).toBe(1)
        expect(countHandlers(client.interceptors.response)).toBe(1)
    })
})

describe('createApiClient — with authSession', () => {
    it('does not touch the global storage configuration', () => {
        createApiClient({ authOptions: { refreshWithCredentials: true } }) // legacy: access-token-only storage
        const spy = vi.spyOn(tokenManager, 'setStorage')

        createApiClient({ authSession: createAuthSession({ refresh: { url: '/r' } }) })
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(spy).not.toHaveBeenCalled()
        expect(tokenManager.getRefreshToken()).toBeNull() // still the legacy configuration
    })

    it("installs the session's interceptors only (no legacy pair on top)", () => {
        const client = createApiClient({
            authSession: createAuthSession({ refresh: { url: '/r' } }),
            authOptions: { refreshUrl: '/legacy' },
        })
        expect(countHandlers(client.interceptors.request)).toBe(1)
        expect(countHandlers(client.interceptors.response)).toBe(1)
    })

    it('keeps the same instance defaults (timeout, JSON content type, custom config)', () => {
        const client = createApiClient({
            authSession: createAuthSession({ refresh: { url: '/r' } }),
            baseURL: 'https://tools.example',
        })
        expect(client.defaults.timeout).toBe(60000)
        expect(client.defaults.baseURL).toBe('https://tools.example')
        expect(client.defaults.headers['Content-Type']).toBe('application/json')

        const custom = createApiClient({ authSession: createAuthSession({ refresh: { url: '/r' } }), timeout: 5000 })
        expect(custom.defaults.timeout).toBe(5000)
    })

    it('does not forward the session object into the axios config', () => {
        const client = createApiClient({ authSession: createAuthSession({ refresh: { url: '/r' } }) })
        expect('authSession' in client.defaults).toBe(false)
    })
})

/** Number of registered handlers on an axios interceptor manager. */
function countHandlers(manager: object): number {
    // axios' public type omits forEach, but every InterceptorManager implements it
    // (lib/core/InterceptorManager.js) — it skips ejected handlers, which is what we count
    const withForEach = manager as { forEach: (fn: (handler: unknown) => void) => void }
    let count = 0
    withForEach.forEach(() => { count++ })
    return count
}
