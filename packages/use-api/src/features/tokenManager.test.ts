/**
 * TokenManager — baseline tests
 *
 * Covers:
 *  - setTokens(): persists accessToken, refreshToken, expiresAt
 *  - clearTokens(): removes all storage keys
 *  - isTokenExpired(): false when not expired / true when past / 5s buffer / null expiry
 *  - getAuthHeader(): "Bearer <token>" or null
 *  - setStorage(): replacing storage doesn't affect original localStorage
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
    TokenManager,
    LocalStorageTokenStorage,
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    TOKEN_EXPIRES_KEY,
} from './tokenManager'
import type { TokenStorage, AuthTokens } from './tokenManager'

// ---------------------------------------------------------------------------
// Use real localStorage (jsdom provides it in vitest's browser-like environment)
// ---------------------------------------------------------------------------

beforeEach(() => {
    localStorage.clear()
})

// ---------------------------------------------------------------------------
// setTokens
// ---------------------------------------------------------------------------

describe('TokenManager — setTokens', () => {
    it('persists accessToken in localStorage', () => {
        const tm = new TokenManager()
        tm.setTokens({ accessToken: 'access-abc' })
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('access-abc')
    })

    it('persists refreshToken in localStorage (default storeRefreshToken = true)', () => {
        const tm = new TokenManager()
        tm.setTokens({ accessToken: 'access-abc', refreshToken: 'refresh-xyz' })
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-xyz')
    })

    it('calculates and stores expiresAt from expiresIn seconds', () => {
        const before = Date.now()
        const tm = new TokenManager()
        tm.setTokens({ accessToken: 'tok', expiresIn: 3600 })
        const after = Date.now()

        const stored = parseInt(localStorage.getItem(TOKEN_EXPIRES_KEY) ?? '0', 10)
        expect(stored).toBeGreaterThanOrEqual(before + 3600 * 1000)
        expect(stored).toBeLessThanOrEqual(after + 3600 * 1000)
    })

    it('does NOT store refreshToken when storeRefreshToken = false', () => {
        const storage = new LocalStorageTokenStorage({ storeRefreshToken: false })
        const tm = new TokenManager(storage)
        tm.setTokens({ accessToken: 'tok', refreshToken: 'refresh' })
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    })

    it('does nothing if accessToken is missing', () => {
        const tm = new TokenManager()
        tm.setTokens({} as AuthTokens)
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// clearTokens
// ---------------------------------------------------------------------------

describe('TokenManager — clearTokens', () => {
    it('removes accessToken from localStorage', () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'tok')
        const tm = new TokenManager()
        tm.clearTokens()
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
    })

    it('removes refreshToken from localStorage', () => {
        localStorage.setItem(REFRESH_TOKEN_KEY, 'ref')
        const tm = new TokenManager()
        tm.clearTokens()
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    })

    it('removes tokenExpiresAt from localStorage', () => {
        localStorage.setItem(TOKEN_EXPIRES_KEY, '9999999999000')
        const tm = new TokenManager()
        tm.clearTokens()
        expect(localStorage.getItem(TOKEN_EXPIRES_KEY)).toBeNull()
    })

    it('also clears the internal refreshPromise', async () => {
        const tm = new TokenManager()
        const p = Promise.resolve<string | null>('new-token')
        tm.setRefreshPromise(p)
        tm.clearTokens()
        expect(tm.getRefreshPromise()).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// isTokenExpired
// ---------------------------------------------------------------------------

describe('TokenManager — isTokenExpired', () => {
    it('returns false when token is not yet expired', () => {
        // expiresAt = now + 1 hour (well outside the 5s buffer)
        localStorage.setItem(TOKEN_EXPIRES_KEY, (Date.now() + 3_600_000).toString())
        const tm = new TokenManager()
        expect(tm.isTokenExpired()).toBe(false)
    })

    it('returns true when token is past its expiresAt', () => {
        // expiresAt = now - 1 hour
        localStorage.setItem(TOKEN_EXPIRES_KEY, (Date.now() - 3_600_000).toString())
        const tm = new TokenManager()
        expect(tm.isTokenExpired()).toBe(true)
    })

    it('returns true when within the 5-second buffer window', () => {
        // expiresAt = now + 3s (inside the 5s buffer, so treated as expired)
        localStorage.setItem(TOKEN_EXPIRES_KEY, (Date.now() + 3_000).toString())
        const tm = new TokenManager()
        expect(tm.isTokenExpired()).toBe(true)
    })

    it('returns false when no expiresAt is stored (treats token as non-expiring)', () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'tok')
        const tm = new TokenManager()
        expect(tm.isTokenExpired()).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// getAuthHeader
// ---------------------------------------------------------------------------

describe('TokenManager — getAuthHeader', () => {
    it('returns "Bearer <token>" when an accessToken is stored', () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'my-token')
        const tm = new TokenManager()
        expect(tm.getAuthHeader()).toBe('Bearer my-token')
    })

    it('returns null when no accessToken is stored', () => {
        const tm = new TokenManager()
        expect(tm.getAuthHeader()).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// setStorage
// ---------------------------------------------------------------------------

describe('TokenManager — setStorage', () => {
    it('replacing storage does not affect the original localStorage state', () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'original')
        const tm = new TokenManager()

        // Custom in-memory storage double
        const stored: Record<string, string> = {}
        const memStorage: TokenStorage = {
            getAccessToken: () => stored['at'] ?? null,
            getRefreshToken: () => null,
            setTokens: (tokens) => { if (tokens.accessToken) stored['at'] = tokens.accessToken },
            clearTokens: () => { delete stored['at'] },
            isTokenExpired: () => false,
            getTokenExpiresAt: () => null,
        }

        tm.setStorage(memStorage)
        tm.setTokens({ accessToken: 'in-memory' })

        // Verify new storage is used
        expect(tm.getAccessToken()).toBe('in-memory')
        expect(stored['at']).toBe('in-memory')

        // Verify original localStorage was NOT touched
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('original')
    })

    it('getAuthHeader uses the new storage after setStorage()', () => {
        const tm = new TokenManager()

        const memStorage: TokenStorage = {
            getAccessToken: () => 'mem-token',
            getRefreshToken: () => null,
            setTokens: vi.fn(),
            clearTokens: vi.fn(),
            isTokenExpired: () => false,
            getTokenExpiresAt: () => null,
        }
        tm.setStorage(memStorage)

        expect(tm.getAuthHeader()).toBe('Bearer mem-token')
    })
})
