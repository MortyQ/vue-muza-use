/**
 * createApiClient — full coverage
 *
 * Covers:
 *  - returns a valid axios instance
 *  - applies baseURL and timeout from options
 *  - default timeout is 60000
 *  - calls setupInterceptors when withAuth: true (default)
 *  - skips setupInterceptors when withAuth: false
 *  - passes authOptions to setupInterceptors
 *  - refreshWithCredentials: true → storeRefreshToken: false (refresh token in cookie)
 *  - refreshWithCredentials: false → storeRefreshToken: true (refresh token in localStorage)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./interceptors', () => ({ setupInterceptors: vi.fn() }))

import { createApiClient } from './createInstance'
import { setupInterceptors } from './interceptors'
import { tokenManager } from './tokenManager'

beforeEach(() => {
    vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Basic instance
// ---------------------------------------------------------------------------

describe('createApiClient — instance', () => {
    it('returns an object with standard axios methods', () => {
        const client = createApiClient()
        expect(typeof client.get).toBe('function')
        expect(typeof client.post).toBe('function')
        expect(typeof client.request).toBe('function')
    })

    it('applies baseURL', () => {
        const client = createApiClient({ baseURL: 'https://api.example.com' })
        expect(client.defaults.baseURL).toBe('https://api.example.com')
    })

    it('applies custom timeout', () => {
        const client = createApiClient({ timeout: 5000 })
        expect(client.defaults.timeout).toBe(5000)
    })

    it('default timeout is 60000', () => {
        const client = createApiClient()
        expect(client.defaults.timeout).toBe(60000)
    })
})

// ---------------------------------------------------------------------------
// withAuth flag
// ---------------------------------------------------------------------------

describe('createApiClient — withAuth', () => {
    it('calls setupInterceptors by default (withAuth not specified)', () => {
        createApiClient()
        expect(setupInterceptors).toHaveBeenCalledOnce()
    })

    it('calls setupInterceptors when withAuth: true', () => {
        createApiClient({ withAuth: true })
        expect(setupInterceptors).toHaveBeenCalledOnce()
    })

    it('does NOT call setupInterceptors when withAuth: false', () => {
        createApiClient({ withAuth: false })
        expect(setupInterceptors).not.toHaveBeenCalled()
    })

    it('passes the created axios instance as first arg to setupInterceptors', () => {
        const client = createApiClient({ withAuth: true })
        const [instance] = (setupInterceptors as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(instance).toBe(client)
    })

    it('passes authOptions as second arg to setupInterceptors', () => {
        const authOptions = { refreshUrl: '/api/token/refresh' }
        createApiClient({ authOptions })
        const [, opts] = (setupInterceptors as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(opts).toBe(authOptions)
    })
})

// ---------------------------------------------------------------------------
// refreshWithCredentials → storeRefreshToken
// ---------------------------------------------------------------------------

describe('createApiClient — refreshWithCredentials / storeRefreshToken', () => {
    it('refreshWithCredentials: true → refresh token NOT stored in localStorage', () => {
        createApiClient({ authOptions: { refreshWithCredentials: true } })
        // When storeRefreshToken: false, getRefreshToken() always returns null
        tokenManager.setTokens({ accessToken: 'acc', refreshToken: 'ref' })
        expect(tokenManager.getRefreshToken()).toBeNull()
        tokenManager.clearTokens()
    })

    it('refreshWithCredentials: false → refresh token IS stored in localStorage', () => {
        createApiClient({ authOptions: { refreshWithCredentials: false } })
        tokenManager.setTokens({ accessToken: 'acc', refreshToken: 'ref' })
        expect(tokenManager.getRefreshToken()).toBe('ref')
        tokenManager.clearTokens()
    })

    it('no authOptions → refresh token IS stored (default behaviour)', () => {
        createApiClient()
        tokenManager.setTokens({ accessToken: 'acc', refreshToken: 'mytoken' })
        expect(tokenManager.getRefreshToken()).toBe('mytoken')
        tokenManager.clearTokens()
    })
})
