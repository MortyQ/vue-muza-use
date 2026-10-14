/**
 * createAuthSession — custom token stores
 *
 * Covers (openspec/changes/add-token-storage-keys):
 *  - use-api-auth-session: storeRefreshToken applies only to the default store
 *  - use-api-token-storage: token store classes are public (imported from the
 *    package entry, second store as `tokens`, in-memory TokenStorage, singleton identity)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    createAuthSession,
    setAuthMonitor,
    tokenManager,
    TokenManager,
    LocalStorageTokenStorage,
    type TokenStorage,
    type TokenStorageKeys,
    type AuthTokens,
} from '../../src/index'

const PARTNER_KEYS: TokenStorageKeys = {
    accessToken: 'partner:accessToken',
    refreshToken: 'partner:refreshToken',
    expiresAt: 'partner:expiresAt',
}

function partnerStore(options: { storeRefreshToken?: boolean } = {}): TokenManager {
    return new TokenManager(new LocalStorageTokenStorage({ keys: PARTNER_KEYS, ...options }))
}

const refresh = async () => ({ accessToken: 'x' })

beforeEach(() => {
    localStorage.clear()
    tokenManager.setStorage(new LocalStorageTokenStorage())
    setAuthMonitor(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('createAuthSession — storeRefreshToken and the default store', () => {
    it('without tokens: configures the singleton as in 1.9.x', () => {
        createAuthSession({ refresh, storeRefreshToken: false })
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(tokenManager.getAccessToken()).toBe('a')
        expect(tokenManager.getRefreshToken()).toBeNull()
        expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('with the singleton passed explicitly: no error, same behaviour', () => {
        expect(() => createAuthSession({ refresh, tokens: tokenManager, storeRefreshToken: false })).not.toThrow()
        tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' })

        expect(tokenManager.getAccessToken()).toBe('a')
        expect(tokenManager.getRefreshToken()).toBeNull()
    })
})

describe('createAuthSession — storeRefreshToken with a custom store', () => {
    it.each([false, true])('storeRefreshToken: %s throws a TypeError and replaces no storage', (storeRefreshToken) => {
        const custom = partnerStore()
        const customSetStorage = vi.spyOn(custom, 'setStorage')
        const singletonSetStorage = vi.spyOn(tokenManager, 'setStorage')

        expect(() => createAuthSession({ refresh, tokens: custom, storeRefreshToken })).toThrow(TypeError)
        expect(() => createAuthSession({ refresh, tokens: custom, storeRefreshToken })).toThrow(/LocalStorageTokenStorage/)
        expect(customSetStorage).not.toHaveBeenCalled()
        expect(singletonSetStorage).not.toHaveBeenCalled()

        // The custom store still writes its own keys
        custom.setTokens({ accessToken: 'b1' })
        expect(localStorage.getItem('partner:accessToken')).toBe('b1')
        expect(localStorage.getItem('accessToken')).toBeNull()
    })

    it('without storeRefreshToken leaves the custom store exactly as passed', () => {
        const custom = partnerStore({ storeRefreshToken: false })
        const setStorage = vi.spyOn(custom, 'setStorage')

        expect(() => createAuthSession({ refresh, tokens: custom })).not.toThrow()
        expect(setStorage).not.toHaveBeenCalled()

        custom.setTokens({ accessToken: 'b1', refreshToken: 'r1' })
        expect(localStorage.getItem('partner:accessToken')).toBe('b1')
        expect(localStorage.getItem('partner:refreshToken')).toBeNull()
        expect(custom.getRefreshToken()).toBeNull()
    })
})

describe('Token store classes are public', () => {
    it('a second store as tokens confines the session to its keys', async () => {
        tokenManager.setTokens({ accessToken: 'a1', refreshToken: 'ra', expiresIn: 3600 })
        const mainExpiry = tokenManager.getTokenExpiresAt()

        const partner = partnerStore()
        partner.setTokens({ accessToken: 'b0' })
        const transport = vi.fn(async () => ({ accessToken: 'b1', refreshToken: 'rb', expiresIn: 60 }))
        const session = createAuthSession({ refresh: transport, tokens: partner })

        expect(session.getAccessToken()).toBe('b0')
        await expect(session.refresh()).resolves.toBe('b1')

        expect(localStorage.getItem('partner:accessToken')).toBe('b1')
        expect(localStorage.getItem('partner:refreshToken')).toBe('rb')
        expect(session.getAuthHeader()).toBe('Bearer b1')
        expect(tokenManager.getAccessToken()).toBe('a1')
        expect(tokenManager.getRefreshToken()).toBe('ra')
        expect(tokenManager.getTokenExpiresAt()).toBe(mainExpiry)

        session.clear()
        expect(partner.getAccessToken()).toBeNull()
        expect(tokenManager.getAccessToken()).toBe('a1')
    })

    it('a session over an in-memory TokenStorage never touches localStorage', async () => {
        let current: AuthTokens | null = { accessToken: 'm0' }
        const memoryStorage: TokenStorage = {
            getAccessToken: () => current?.accessToken ?? null,
            getRefreshToken: () => current?.refreshToken ?? null,
            setTokens: (tokens) => { current = tokens },
            clearTokens: () => { current = null },
            getTokenExpiresAt: () => null,
            isTokenExpired: () => false,
        }
        const storageSpy = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() }
        vi.stubGlobal('localStorage', storageSpy)

        const session = createAuthSession({
            refresh: async () => ({ accessToken: 'm1' }),
            tokens: new TokenManager(memoryStorage),
        })

        expect(session.getAccessToken()).toBe('m0')
        await expect(session.refresh()).resolves.toBe('m1')
        expect(current).toEqual({ accessToken: 'm1' })
        session.clear()
        expect(current).toBeNull()

        expect(storageSpy.getItem).not.toHaveBeenCalled()
        expect(storageSpy.setItem).not.toHaveBeenCalled()
        expect(storageSpy.removeItem).not.toHaveBeenCalled()
    })

    it('the tokenManager singleton is an instance of the exported TokenManager', () => {
        expect(tokenManager).toBeInstanceOf(TokenManager)
    })
})
