/**
 * useApiBatch — named clients
 *
 * Covers the "Batch requests support clients" spec scenarios:
 *  - mixed batch: batch-level client, item without client, item with client: "default"
 *  - cache hit on a named client is served from the client-scoped entry
 * plus: default batches keep their cache keys, client never reaches axios,
 * an unknown item-level client fails that item (not the batch), and cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { AxiosInstance } from 'axios'
import { effectScope, type EffectScope } from 'vue'
import { useApiBatch } from '../src/useApiBatch'
import { createApi } from '../src/plugin'
import { clearAllCache, readCache } from '../src/features/cacheManager'

function mockInstance(label: string): AxiosInstance & { request: Mock } {
    const request = vi.fn((config: { url?: string }) =>
        Promise.resolve({ data: { from: label, url: config.url }, status: 200 }),
    )
    return {
        request,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
        defaults: { headers: { common: {} } },
    } as unknown as AxiosInstance & { request: Mock }
}

let main: ReturnType<typeof mockInstance>
let tools: ReturnType<typeof mockInstance>

const openScopes: EffectScope[] = []
function inScope<T>(factory: () => T): T {
    const scope = effectScope()
    openScopes.push(scope)
    return scope.run(factory)!
}

beforeEach(() => {
    clearAllCache()
    main = mockInstance('main')
    tools = mockInstance('tools')
    createApi({ axios: main, clients: { tools } })
})

afterEach(() => {
    openScopes.splice(0).forEach(scope => scope.stop())
    vi.restoreAllMocks()
})

describe('useApiBatch clients — routing', () => {
    it('batch-level client applies to items without one; an item client wins', async () => {
        const { execute } = inScope(() => useApiBatch(
            [{ url: '/a' }, { url: '/b', client: 'default' }],
            { client: 'tools' },
        ))

        const results = await execute()

        expect(results.map(r => (r.data as { from: string }).from)).toEqual(['tools', 'main'])
        expect(tools.request).toHaveBeenCalledTimes(1)
        expect(main.request).toHaveBeenCalledTimes(1)
    })

    it('an item client works without a batch-level client', async () => {
        const { execute } = inScope(() => useApiBatch(['/a', { url: '/b', client: 'tools' }]))

        const results = await execute()
        expect(results.map(r => (r.data as { from: string }).from)).toEqual(['main', 'tools'])
    })

    it('never forwards client to axios', async () => {
        const { execute } = inScope(() => useApiBatch([{ url: '/b', client: 'tools' }], { client: 'tools' }))
        await execute()
        expect('client' in tools.request.mock.calls[0][0]).toBe(false)
    })

    it('an unknown item client fails that item only', async () => {
        const { execute, errors } = inScope(() => useApiBatch(['/ok', { url: '/bad', client: 'nope' }]))

        const results = await execute()

        expect(results[0]).toMatchObject({ status: 'success' })
        expect(results[1]).toMatchObject({ status: 'error', error: { code: 'BATCH_ERROR' } })
        expect(results[1].error?.message).toContain('Unknown API client "nope"')
        expect(errors.value).toHaveLength(1)
    })
})

describe('useApiBatch clients — cache', () => {
    it('serves a repeated named-client item from its client-scoped entry', async () => {
        const { execute } = inScope(() => useApiBatch(['/brands'], { client: 'tools', cache: true }))

        await execute()
        const second = await execute()

        expect(tools.request).toHaveBeenCalledTimes(1)
        expect(second[0]).toMatchObject({ status: 'success', data: { from: 'tools', url: '/brands' } })
        expect(readCache('auto@tools:GET:/brands::')).toEqual({ from: 'tools', url: '/brands' })
    })

    it('does not serve a default-client entry to a named-client item for the same path', async () => {
        const viaMain = inScope(() => useApiBatch(['/brands'], { cache: true }))
        const viaTools = inScope(() => useApiBatch(['/brands'], { client: 'tools', cache: true }))

        await viaMain.execute()
        const results = await viaTools.execute()

        expect(tools.request).toHaveBeenCalledTimes(1)
        expect(results[0].data).toEqual({ from: 'tools', url: '/brands' })
        expect(readCache('auto:GET:/brands::')).toEqual({ from: 'main', url: '/brands' })
    })

    it('per-item client is part of the batch cache read', async () => {
        const { execute } = inScope(() => useApiBatch(
            [{ url: '/x' }, { url: '/x', client: 'tools' }],
            { cache: true },
        ))

        await execute()
        await execute()

        expect(main.request).toHaveBeenCalledTimes(1)
        expect(tools.request).toHaveBeenCalledTimes(1)
    })
})

describe('useApiBatch clients — cleanup', () => {
    it('aborts in-flight named-client requests when the scope stops', async () => {
        let seenSignal: AbortSignal | undefined
        tools.request.mockImplementation((config: { signal?: AbortSignal }) => new Promise(() => {
            seenSignal = config.signal
        }))
        const scope = effectScope()
        const batch = scope.run(() => useApiBatch(['/slow'], { client: 'tools' }))!

        void batch.execute()
        await Promise.resolve()
        await Promise.resolve()
        scope.stop()

        expect(seenSignal?.aborted).toBe(true)
    })
})
