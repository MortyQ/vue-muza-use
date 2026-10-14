/**
 * LocalStorageTokenStorage — custom storage keys
 *
 * Covers (openspec/changes/add-token-storage-keys, use-api-token-storage):
 *  - default store writes exactly the three default keys
 *  - custom keys: read / write / clear, storeRefreshToken: false, storage unavailable
 *  - two stores with different keys are independent (tokens, clear, expiry)
 *  - invalid keys are rejected at construction
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    TokenManager,
    LocalStorageTokenStorage,
    tokenManager,
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    TOKEN_EXPIRES_KEY,
} from '../../src/features/tokenManager'
import type { TokenStorageKeys } from '../../src/types'

const PARTNER_KEYS: TokenStorageKeys = {
    accessToken: 'bAccess',
    refreshToken: 'bRefresh',
    expiresAt: 'bExpiresAt',
}

function storedKeys(): string[] {
    return Object.keys(localStorage).sort()
}

beforeEach(() => {
    localStorage.clear()
    tokenManager.setStorage(new LocalStorageTokenStorage())
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('LocalStorageTokenStorage — default keys', () => {
    it('writes exactly accessToken, refreshToken and tokenExpiresAt', () => {
        vi.useFakeTimers({ now: 1_000_000 })
        new LocalStorageTokenStorage().setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 60 })

        expect(storedKeys()).toEqual([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, TOKEN_EXPIRES_KEY].sort())
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('a')
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r')
        expect(localStorage.getItem(TOKEN_EXPIRES_KEY)).toBe(String(1_000_000 + 60_000))
    })
})

describe('LocalStorageTokenStorage — custom keys', () => {
    it('reads and writes only the custom keys', () => {
        vi.useFakeTimers({ now: 1_000_000 })
        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS })
        storage.setTokens({ accessToken: 'b1', expiresIn: 60 })

        expect(storedKeys()).toEqual(['bAccess', 'bExpiresAt'])
        expect(localStorage.getItem('bAccess')).toBe('b1')
        expect(storage.getAccessToken()).toBe('b1')
        expect(storage.getTokenExpiresAt()).toBe(1_000_000 + 60_000)
    })

    it('writes the refresh token under the custom refresh key', () => {
        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS })
        storage.setTokens({ accessToken: 'b1', refreshToken: 'r1' })

        expect(localStorage.getItem('bRefresh')).toBe('r1')
        expect(storage.getRefreshToken()).toBe('r1')
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    })

    it('clearTokens removes only the custom keys', () => {
        localStorage.setItem('unrelated', 'x')
        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS })
        storage.setTokens({ accessToken: 'b1', refreshToken: 'r1', expiresIn: 60 })
        storage.clearTokens()

        expect(storedKeys()).toEqual(['unrelated'])
    })

    it('with storeRefreshToken: false never writes or removes the custom refresh key', () => {
        localStorage.setItem('bRefresh', 'cookie-era-leftover')
        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS, storeRefreshToken: false })

        storage.setTokens({ accessToken: 'b1', refreshToken: 'r1' })
        expect(localStorage.getItem('bRefresh')).toBe('cookie-era-leftover')
        expect(storage.getRefreshToken()).toBeNull()

        storage.clearTokens()
        expect(localStorage.getItem('bRefresh')).toBe('cookie-era-leftover')
        expect(localStorage.getItem('bAccess')).toBeNull()
    })

    it('expiry uses the 5-second buffer of the default store', () => {
        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS })
        localStorage.setItem('bExpiresAt', String(Date.now() + 3_000))
        expect(storage.isTokenExpired()).toBe(true)

        localStorage.setItem('bExpiresAt', String(Date.now() + 3_600_000))
        expect(storage.isTokenExpired()).toBe(false)
    })
})

describe('LocalStorageTokenStorage — custom keys, storage unavailable', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('no call throws, reads return null, isTokenExpired is false', () => {
        // Stub the whole global: happy-dom caches localStorage methods once they
        // are read, so a Storage.prototype spy is bypassed after earlier tests.
        const fail = () => { throw new Error('SecurityError: denied') }
        vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail })

        const storage = new LocalStorageTokenStorage({ keys: PARTNER_KEYS })

        expect(() => storage.setTokens({ accessToken: 'b1', refreshToken: 'r1', expiresIn: 60 })).not.toThrow()
        expect(storage.getAccessToken()).toBeNull()
        expect(storage.getRefreshToken()).toBeNull()
        expect(storage.getTokenExpiresAt()).toBeNull()
        expect(storage.isTokenExpired()).toBe(false)
        expect(() => storage.clearTokens()).not.toThrow()
    })
})

describe('Stores with different keys are independent', () => {
    it('a second store does not touch the default store', () => {
        tokenManager.setTokens({ accessToken: 'a1', expiresIn: 3600 })
        const mainExpiry = tokenManager.getTokenExpiresAt()

        const partner = new TokenManager(new LocalStorageTokenStorage({ keys: PARTNER_KEYS }))
        partner.setTokens({ accessToken: 'b1', expiresIn: 60 })

        expect(tokenManager.getAccessToken()).toBe('a1')
        expect(tokenManager.getTokenExpiresAt()).toBe(mainExpiry)
        expect(partner.getAccessToken()).toBe('b1')
    })

    it('clearing the second store keeps the default store', () => {
        tokenManager.setTokens({ accessToken: 'a1', refreshToken: 'ra', expiresIn: 3600 })
        const mainExpiry = tokenManager.getTokenExpiresAt()
        const partner = new TokenManager(new LocalStorageTokenStorage({ keys: PARTNER_KEYS }))
        partner.setTokens({ accessToken: 'b1', refreshToken: 'rb', expiresIn: 60 })

        partner.clearTokens()

        expect(tokenManager.getAccessToken()).toBe('a1')
        expect(tokenManager.getRefreshToken()).toBe('ra')
        expect(tokenManager.getTokenExpiresAt()).toBe(mainExpiry)
        expect(partner.getAccessToken()).toBeNull()
        expect(partner.getRefreshToken()).toBeNull()
        expect(partner.getTokenExpiresAt()).toBeNull()
    })

    it('expiry is tracked per store', () => {
        tokenManager.setTokens({ accessToken: 'a1', expiresIn: 3600 })
        const partner = new TokenManager(new LocalStorageTokenStorage({ keys: PARTNER_KEYS }))
        partner.setTokens({ accessToken: 'b1', expiresIn: 60 })

        localStorage.setItem('bExpiresAt', String(Date.now() - 1_000))

        expect(partner.isTokenExpired()).toBe(true)
        expect(tokenManager.isTokenExpired()).toBe(false)
    })
})

describe('LocalStorageTokenStorage — invalid keys', () => {
    it('rejects an empty key name, naming the role', () => {
        expect(() => new LocalStorageTokenStorage({
            keys: { accessToken: '', refreshToken: 'r', expiresAt: 'e' },
        })).toThrow(TypeError)
        expect(() => new LocalStorageTokenStorage({
            keys: { accessToken: '', refreshToken: 'r', expiresAt: 'e' },
        })).toThrow(/accessToken/)
    })

    it('rejects a non-string key name at runtime', () => {
        const keys = { accessToken: 'a', refreshToken: 'r', expiresAt: 42 } as unknown as TokenStorageKeys
        expect(() => new LocalStorageTokenStorage({ keys })).toThrow(/expiresAt/)
    })

    it('rejects two roles sharing one key, naming both, without touching localStorage', () => {
        const spy = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
        vi.stubGlobal('localStorage', spy)
        const create = () => new LocalStorageTokenStorage({
            keys: { accessToken: 'same', refreshToken: 'r', expiresAt: 'same' },
        })

        try {
            expect(create).toThrow(TypeError)
            expect(create).toThrow(/accessToken.*expiresAt/)
            expect(spy.getItem).not.toHaveBeenCalled()
            expect(spy.setItem).not.toHaveBeenCalled()
            expect(spy.removeItem).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('still requires a distinct refresh key when storeRefreshToken is false', () => {
        expect(() => new LocalStorageTokenStorage({
            storeRefreshToken: false,
            keys: { accessToken: 'same', refreshToken: 'same', expiresAt: 'e' },
        })).toThrow(/accessToken.*refreshToken/)
    })
})
