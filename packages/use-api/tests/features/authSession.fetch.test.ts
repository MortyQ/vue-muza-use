/**
 * createAuthSession — `session.fetch`
 *
 * Covers the "Auth-aware fetch" spec scenarios (retry after refresh, refresh fails,
 * non-replayable body, custom fetch implementation) plus: caller-supplied
 * Authorization is passed through, a `Request` input is replayed, a concurrent
 * 401 from fetch and from an attached axios instance shares one refresh, and
 * the function is bound.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthSession } from '../../src/features/authSession'
import { createApiClient } from '../../src/features/createInstance'
import { tokenManager, LocalStorageTokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor } from '../../src/features/monitor'
import { useGlobalFakeAdapter, fullUrl, deferred } from './authSession.fixtures'

interface SentRequest {
    url: string
    method: string
    auth: string | null
    headers: Headers
    body: string | null
}

/**
 * Fake `fetch` that records each call (body read as text) and answers 200 only
 * for `Bearer <acceptedToken>` — everything else gets a 401.
 */
function fakeFetch(acceptedToken: string) {
    const sent: SentRequest[] = []
    const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init)
        const headers = new Headers(request.headers)
        // Like a real fetch, consume a Request input's own body — sending the same
        // Request twice must then fail, which is what forces the session to clone it
        let body: string | null
        if (input instanceof Request && init?.body === undefined) {
            if (input.bodyUsed) throw new TypeError('Request body already used')
            body = input.body ? await input.text() : null
        } else {
            body = request.body ? await request.text() : null
        }
        sent.push({
            url: request.url,
            method: request.method,
            auth: headers.get('Authorization'),
            headers,
            body,
        })
        const ok = headers.get('Authorization') === `Bearer ${acceptedToken}`
        return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 401 })
    })
    return { impl, sent }
}

let restoreAdapter: (() => void) | null = null

beforeEach(() => {
    tokenManager.setStorage(new LocalStorageTokenStorage())
    tokenManager.clearTokens()
    setAuthMonitor(() => {})
})

afterEach(() => {
    restoreAdapter?.()
    restoreAdapter = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('session.fetch — token and refresh', () => {
    it('sends the current token', async () => {
        tokenManager.setTokens({ accessToken: 'good' })
        const { impl, sent } = fakeFetch('good')
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }), fetch: impl })

        const res = await session.fetch('https://api.example/data')
        expect(res.status).toBe(200)
        expect(sent[0].auth).toBe('Bearer good')
    })

    it('sends no Authorization and never refreshes when there is no token', async () => {
        const { impl, sent } = fakeFetch('good')
        const transport = vi.fn(async () => ({ accessToken: 'good' }))
        const session = createAuthSession({ refresh: transport, fetch: impl })

        const res = await session.fetch('https://api.example/data')
        expect(res.status).toBe(401)
        expect(sent[0].auth).toBeNull()
        expect(transport).not.toHaveBeenCalled()
    })

    it('on 401 refreshes and repeats the request once with the new token', async () => {
        tokenManager.setTokens({ accessToken: 'old' })
        const { impl, sent } = fakeFetch('new')
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'new' }), fetch: impl })

        const res = await session.fetch('https://api.example/data', {
            method: 'POST',
            body: JSON.stringify({ q: 1 }),
            headers: { 'X-Trace': 't1', 'Content-Type': 'application/json' },
        })

        expect(res.status).toBe(200)
        expect(sent.map((r) => r.auth)).toEqual(['Bearer old', 'Bearer new'])
        expect(sent[1].body).toBe('{"q":1}')
        expect(sent[1].headers.get('X-Trace')).toBe('t1')
        expect(sent[1].method).toBe('POST')
    })

    it('returns the original 401 and emits refreshFailed when the refresh fails', async () => {
        tokenManager.setTokens({ accessToken: 'old' })
        const { impl, sent } = fakeFetch('new')
        const session = createAuthSession({ refresh: async () => { throw new Error('nope') }, fetch: impl })
        const onFailed = vi.fn()
        session.on('refreshFailed', onFailed)

        const res = await session.fetch('https://api.example/data')

        expect(res.status).toBe(401)
        expect(sent).toHaveLength(1)
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(tokenManager.getAccessToken()).toBeNull()
    })

    it('refreshes but returns the original 401 for a ReadableStream body', async () => {
        tokenManager.setTokens({ accessToken: 'old' })
        const { impl } = fakeFetch('new')
        const transport = vi.fn(async () => ({ accessToken: 'new' }))
        const session = createAuthSession({ refresh: transport, fetch: impl })
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('chunk'))
                controller.close()
            },
        })

        const res = await session.fetch('https://api.example/upload', {
            method: 'POST',
            body: stream,
            duplex: 'half',
        } as RequestInit)

        expect(res.status).toBe(401)
        expect(transport).toHaveBeenCalledTimes(1)
        expect(impl).toHaveBeenCalledTimes(1)
        expect(tokenManager.getAccessToken()).toBe('new')
    })

    it('never throws for an HTTP error status', async () => {
        tokenManager.setTokens({ accessToken: 'good' })
        const impl = vi.fn(async () => new Response('boom', { status: 500 }))
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }), fetch: impl })

        await expect(session.fetch('https://api.example/data')).resolves.toMatchObject({ status: 500 })
    })

    it('replays URLSearchParams, FormData and Blob bodies', async () => {
        for (const body of [new URLSearchParams({ a: '1' }), (() => { const f = new FormData(); f.set('a', '1'); return f })(), new Blob(['raw'])]) {
            tokenManager.setTokens({ accessToken: 'old' })
            const { impl } = fakeFetch('new')
            const session = createAuthSession({ refresh: async () => ({ accessToken: 'new' }), fetch: impl })

            const res = await session.fetch('https://api.example/form', { method: 'POST', body })
            expect(res.status).toBe(200)
            expect(impl).toHaveBeenCalledTimes(2)
        }
    })
})

describe('session.fetch — inputs and implementation', () => {
    it('passes a request that already carries Authorization through untouched', async () => {
        tokenManager.setTokens({ accessToken: 'session-token' })
        const { impl, sent } = fakeFetch('new')
        const transport = vi.fn(async () => ({ accessToken: 'new' }))
        const session = createAuthSession({ refresh: transport, fetch: impl })

        const res = await session.fetch('https://api.example/data', { headers: { Authorization: 'Bearer own' } })

        expect(res.status).toBe(401)
        expect(sent).toHaveLength(1)
        expect(sent[0].auth).toBe('Bearer own')
        expect(transport).not.toHaveBeenCalled()
    })

    it('also passes through a Request object carrying Authorization', async () => {
        tokenManager.setTokens({ accessToken: 'session-token' })
        const { impl, sent } = fakeFetch('own')
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }), fetch: impl })

        await session.fetch(new Request('https://api.example/data', { headers: { Authorization: 'Bearer own' } }))
        expect(sent[0].auth).toBe('Bearer own')
    })

    it('replays a Request input, body included', async () => {
        tokenManager.setTokens({ accessToken: 'old' })
        const { impl, sent } = fakeFetch('new')
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'new' }), fetch: impl })

        const res = await session.fetch(new Request('https://api.example/graphql', {
            method: 'POST',
            body: '{"query":"{ me { id } }"}',
            headers: { 'Content-Type': 'application/json' },
        }))

        expect(res.status).toBe(200)
        expect(sent.map((r) => [r.auth, r.body])).toEqual([
            ['Bearer old', '{"query":"{ me { id } }"}'],
            ['Bearer new', '{"query":"{ me { id } }"}'],
        ])
        expect(sent[1].headers.get('Content-Type')).toBe('application/json')
    })

    it('delegates to a custom fetch implementation', async () => {
        const custom = vi.fn(async () => new Response('ok'))
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }), fetch: custom })

        await session.fetch('/anything')
        expect(custom).toHaveBeenCalledTimes(1)
    })

    it('looks up globalThis.fetch at call time', async () => {
        const session = createAuthSession({ refresh: async () => ({ accessToken: 'x' }) })
        const stubbed = vi.fn(async () => new Response('late'))
        vi.stubGlobal('fetch', stubbed)

        await expect((await session.fetch('/x')).text()).resolves.toBe('late')
        expect(stubbed).toHaveBeenCalledTimes(1)
    })

    it('is bound — works when destructured', async () => {
        const custom = vi.fn(async () => new Response('ok'))
        const { fetch: boundFetch } = createAuthSession({ refresh: async () => ({ accessToken: 'x' }), fetch: custom })

        await expect(boundFetch('/x')).resolves.toBeInstanceOf(Response)
    })
})

describe('session.fetch — shares the refresh with attached instances', () => {
    it('a 401 from fetch and from an axios instance at the same time trigger one refresh', async () => {
        const gate = deferred<void>()
        const { adapter, restore } = useGlobalFakeAdapter(async (config) => {
            if (fullUrl(config).endsWith('/auth/refresh')) {
                await gate.promise
                return { status: 200, data: { accessToken: 'new' } }
            }
            return config.headers.get('Authorization') === 'Bearer new'
                ? { status: 200, data: { ok: true } }
                : { status: 401, data: {} }
        })
        restoreAdapter = restore
        tokenManager.setTokens({ accessToken: 'old' })
        const { impl, sent } = fakeFetch('new')
        const session = createAuthSession({ refresh: { url: '/auth/refresh' }, fetch: impl })
        const client = createApiClient({ authSession: session })

        const viaAxios = client.get('/rest')
        const viaFetch = session.fetch('https://api.example/graphql')
        await vi.waitFor(() => {
            expect(sent).toHaveLength(1)
            expect(adapter.calls.some((c) => fullUrl(c).endsWith('/auth/refresh'))).toBe(true)
        })
        gate.resolve()

        await expect(viaAxios).resolves.toMatchObject({ status: 200 })
        expect((await viaFetch).status).toBe(200)
        expect(adapter.calls.filter((c) => fullUrl(c).endsWith('/auth/refresh'))).toHaveLength(1)
        expect(sent.map((r) => r.auth)).toEqual(['Bearer old', 'Bearer new'])
    })
})
