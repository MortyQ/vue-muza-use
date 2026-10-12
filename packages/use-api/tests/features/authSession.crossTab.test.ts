/**
 * createAuthSession — cross-tab coordination (`crossTab`)
 *
 * Two sessions in one test process stand in for two tabs. `navigator.locks` is
 * replaced by a serialising fake (one holder per lock name, FIFO), the shape of
 * the Web Locks API the session relies on.
 *
 * Covers the spec scenarios:
 *  - Cross-tab refresh coordination: second tab adopts the new token,
 *    Web Locks unavailable, disabled by default
 *  - Cross-tab adoption requires a shared token store: per-tab store does not adopt
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthSession, DEFAULT_REFRESH_LOCK_NAME } from '../../src/features/authSession'
import { tokenManager, TokenManager, LocalStorageTokenStorage, type TokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor } from '../../src/features/monitor'
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

/** In-memory token store — one per "tab", never shared. */
function memoryStore(initial: string | null): TokenStorage {
    let access = initial
    return {
        getAccessToken: () => access,
        getRefreshToken: () => null,
        setTokens: (tokens) => { access = tokens.accessToken },
        clearTokens: () => { access = null },
        getTokenExpiresAt: () => null,
        isTokenExpired: () => false,
    }
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')

function setLocks(value: unknown): void {
    Object.defineProperty(navigator, 'locks', { value, configurable: true, writable: true })
}

beforeEach(() => {
    tokenManager.setStorage(new LocalStorageTokenStorage())
    tokenManager.clearTokens()
    setAuthMonitor(() => {})
})

afterEach(() => {
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
    else delete (navigator as unknown as Record<string, unknown>).locks
    vi.restoreAllMocks()
})

describe('crossTab — shared token store (default tokenManager)', () => {
    it('second tab adopts the token the first tab stored while it waited for the lock', async () => {
        const locks = createFakeLocks()
        setLocks(locks)
        tokenManager.setTokens({ accessToken: 't0' })

        const tabARefresh = deferred<{ accessToken: string }>()
        const transportA = vi.fn(() => tabARefresh.promise)
        const transportB = vi.fn(async () => ({ accessToken: 'never' }))
        const tabA = createAuthSession({ refresh: transportA, crossTab: true })
        const tabB = createAuthSession({ refresh: transportB, crossTab: true })
        const onRefreshedB = vi.fn()
        tabB.on('refreshed', onRefreshedB)

        const pA = tabA.refresh({ staleAccessToken: 't0' })
        const pB = tabB.refresh({ staleAccessToken: 't0' })

        tabARefresh.resolve({ accessToken: 't1' })

        await expect(pA).resolves.toBe('t1')
        await expect(pB).resolves.toBe('t1')
        expect(transportA).toHaveBeenCalledTimes(1)
        expect(transportB).not.toHaveBeenCalled()
        expect(onRefreshedB).toHaveBeenCalledWith({ accessToken: 't1', response: null })
        expect(locks.requested).toEqual([DEFAULT_REFRESH_LOCK_NAME, DEFAULT_REFRESH_LOCK_NAME])
    })

    it('refreshes normally when the stored token is still the stale one', async () => {
        setLocks(createFakeLocks())
        tokenManager.setTokens({ accessToken: 't0' })
        const transport = vi.fn(async () => ({ accessToken: 't1' }))
        const session = createAuthSession({ refresh: transport, crossTab: true })

        await expect(session.refresh({ staleAccessToken: 't0' })).resolves.toBe('t1')
        expect(transport).toHaveBeenCalledTimes(1)
    })

    it('uses a custom lock name', async () => {
        const locks = createFakeLocks()
        setLocks(locks)
        const session = createAuthSession({
            refresh: async () => ({ accessToken: 'x' }),
            crossTab: { lockName: 'my-app:refresh' },
        })

        await session.refresh()
        expect(locks.requested).toEqual(['my-app:refresh'])
    })
})

describe('crossTab — per-tab token store', () => {
    it('serialises the refreshes but each tab still refreshes on its own', async () => {
        setLocks(createFakeLocks())
        const order: string[] = []
        const tabARefresh = deferred<{ accessToken: string }>()
        const transportA = vi.fn(async () => {
            order.push('A:start')
            const result = await tabARefresh.promise
            order.push('A:end')
            return result
        })
        const transportB = vi.fn(async () => {
            order.push('B:start')
            return { accessToken: 'tB' }
        })
        const tabA = createAuthSession({ refresh: transportA, crossTab: true, tokens: new TokenManager(memoryStore('t0')) })
        const tabB = createAuthSession({ refresh: transportB, crossTab: true, tokens: new TokenManager(memoryStore('t0')) })

        const pA = tabA.refresh({ staleAccessToken: 't0' })
        const pB = tabB.refresh({ staleAccessToken: 't0' })
        await vi.waitFor(() => expect(order).toContain('A:start'))
        expect(order).not.toContain('B:start')

        tabARefresh.resolve({ accessToken: 'tA' })

        await expect(pA).resolves.toBe('tA')
        await expect(pB).resolves.toBe('tB')
        expect(transportB).toHaveBeenCalledTimes(1)
        expect(order).toEqual(['A:start', 'A:end', 'B:start'])
    })
})

describe('crossTab — availability and default', () => {
    it('falls back to in-tab single-flight when navigator.locks is undefined', async () => {
        setLocks(undefined)
        const transport = vi.fn(async () => ({ accessToken: 'x' }))
        const session = createAuthSession({ refresh: transport, crossTab: true })

        await expect(Promise.all([session.refresh(), session.refresh()])).resolves.toEqual(['x', 'x'])
        expect(transport).toHaveBeenCalledTimes(1)
    })

    it('never calls the Web Locks API when crossTab is not set', async () => {
        const locks = createFakeLocks()
        setLocks(locks)
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }) })

        await session.refresh()
        expect(locks.request).not.toHaveBeenCalled()
    })

    it('never adopts without crossTab, even if the stored token changed', async () => {
        tokenManager.setTokens({ accessToken: 'already-new' })
        const transport = vi.fn(async () => ({ accessToken: 'refreshed' }))
        const session = createAuthSession({ refresh: transport })

        await expect(session.refresh({ staleAccessToken: 'old' })).resolves.toBe('refreshed')
        expect(transport).toHaveBeenCalledTimes(1)
    })
})
