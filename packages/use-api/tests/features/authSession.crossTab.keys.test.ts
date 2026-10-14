/**
 * createAuthSession — cross-tab adoption with a custom-key localStorage store
 *
 * Covers (openspec/changes/add-token-storage-keys, use-api-auth-session):
 *  - Cross-tab adoption requires a shared token store: custom-key localStorage store adopts
 *
 * Two sessions over two TokenManager instances that share one custom key set
 * stand in for the same store in two tabs (localStorage is the shared medium).
 * `navigator.locks` is the same serialising fake as authSession.crossTab.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthSession } from '../../src/features/authSession'
import { tokenManager, TokenManager, LocalStorageTokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor } from '../../src/features/monitor'
import type { TokenStorageKeys } from '../../src/types'
import { deferred } from './authSession.fixtures'

/** Serialising Web Locks fake: callbacks for the same name run one at a time, in request order. */
function createFakeLocks() {
    const tails = new Map<string, Promise<unknown>>()
    const requested: string[] = []
    const request = vi.fn(<T>(name: string, callback: () => Promise<T>): Promise<T> => {
        requested.push(name)
        const previous = tails.get(name) ?? Promise.resolve()
        const result = previous.then(() => callback())
        tails.set(name, result.catch(() => {}))
        return result
    })
    return { request, requested }
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')

function setLocks(value: unknown): void {
    Object.defineProperty(navigator, 'locks', { value, configurable: true, writable: true })
}

const PARTNER_KEYS: TokenStorageKeys = {
    accessToken: 'partner:accessToken',
    refreshToken: 'partner:refreshToken',
    expiresAt: 'partner:expiresAt',
}

function partnerTab(): TokenManager {
    return new TokenManager(new LocalStorageTokenStorage({ keys: PARTNER_KEYS }))
}

beforeEach(() => {
    localStorage.clear()
    tokenManager.setStorage(new LocalStorageTokenStorage())
    setAuthMonitor(() => {})
})

afterEach(() => {
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
    else delete (navigator as unknown as Record<string, unknown>).locks
    vi.restoreAllMocks()
})

describe('crossTab — custom-key localStorage store', () => {
    it('second tab adopts the token the first tab stored under the custom keys', async () => {
        const locks = createFakeLocks()
        setLocks(locks)
        tokenManager.setTokens({ accessToken: 'main' })
        partnerTab().setTokens({ accessToken: 'p0' })

        const crossTab = { lockName: 'partner:refresh' }
        const tabARefresh = deferred<{ accessToken: string }>()
        const transportA = vi.fn(() => tabARefresh.promise)
        const transportB = vi.fn(async () => ({ accessToken: 'never' }))
        const tabA = createAuthSession({ refresh: transportA, crossTab, tokens: partnerTab() })
        const tabB = createAuthSession({ refresh: transportB, crossTab, tokens: partnerTab() })

        const pA = tabA.refresh({ staleAccessToken: 'p0' })
        const pB = tabB.refresh({ staleAccessToken: 'p0' })

        tabARefresh.resolve({ accessToken: 'p1' })

        await expect(pA).resolves.toBe('p1')
        await expect(pB).resolves.toBe('p1')
        expect(transportA).toHaveBeenCalledTimes(1)
        expect(transportB).not.toHaveBeenCalled()
        expect(localStorage.getItem('partner:accessToken')).toBe('p1')
        expect(tokenManager.getAccessToken()).toBe('main')
        expect(locks.requested).toEqual(['partner:refresh', 'partner:refresh'])
    })
})
