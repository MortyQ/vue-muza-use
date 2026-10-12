/**
 * createAuthSession — attached axios instances (`createApiClient({ authSession })`)
 *
 * (a) every scenario of the "Attaching an axios instance" requirement
 * (b) a parity table: the legacy 401 scenarios (tests/features/interceptors.test.ts)
 *     as data, run once against a legacy client and once against a session client,
 *     asserting the same observable outcome — requests sent with their Authorization
 *     header, the result, the stored token and the auth-monitor events
 * (c) two instances, one session, concurrent 401 → one refresh
 * (d) refresh goes to the session's transport, the retry to the instance's baseURL
 * plus the monitor "queued" event, devtools retry flagging and the function-transport
 * `authMode: "public"` contract.
 *
 * Every axios instance is real; HTTP is answered by a fake adapter installed on
 * axios.defaults (so the session's private refresh instance uses it too).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isAxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { createAuthSession } from '../../src/features/authSession'
import { createApiClient } from '../../src/features/createInstance'
import { tokenManager, LocalStorageTokenStorage } from '../../src/features/tokenManager'
import { setAuthMonitor, AuthEventType } from '../../src/features/monitor'
import { devtoolsBridge, __devtoolsInternals } from '../../src/devtools'
import { useGlobalFakeAdapter, fullUrl, deferred, type FakeHandler, type FakeReply } from './authSession.fixtures'

type AuthMode = 'default' | 'public' | 'optional'

/** axios' own config type does not know the library's authMode — tests set it explicitly. */
function withAuthMode(authMode: AuthMode): AxiosRequestConfig {
    return { authMode } as AxiosRequestConfig
}

let restoreAdapter: (() => void) | null = null
let monitorEvents: AuthEventType[] = []

function backend(handler: FakeHandler) {
    const { adapter, restore } = useGlobalFakeAdapter(handler)
    restoreAdapter = restore
    return adapter
}

/** `METHOD full-url Authorization|-` — what the parity table compares. */
function describeRequest(config: InternalAxiosRequestConfig): string {
    const auth = config.headers.get('Authorization')
    return `${(config.method ?? 'get').toUpperCase()} ${fullUrl(config)} ${typeof auth === 'string' ? auth : '-'}`
}

function describeOutcome(settled: PromiseSettledResult<{ status: number }>): string {
    if (settled.status === 'fulfilled') return `resolved:${settled.value.status}`
    const reason = settled.reason
    if (isAxiosError(reason)) return `rejected:${reason.response?.status}`
    return `rejected:${reason instanceof Error ? reason.message : String(reason)}`
}

beforeEach(() => {
    tokenManager.setStorage(new LocalStorageTokenStorage())
    tokenManager.clearTokens()
    monitorEvents = []
    setAuthMonitor((type) => { monitorEvents.push(type) })
})

afterEach(() => {
    restoreAdapter?.()
    restoreAdapter = null
    __devtoolsInternals().reset()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// (b) Parity table — legacy client vs session client
// ---------------------------------------------------------------------------

interface ParityScenario {
    name: string
    initialToken: string | null
    /** Answers for the data endpoint (`/api/data*`), given the Authorization header it got. */
    data: (auth: string | null) => FakeReply
    /** Answer for the refresh endpoint. */
    refresh: FakeReply
    /** How many concurrent requests to send. */
    concurrent?: number
    authMode?: AuthMode
    expected: {
        requests: string[]
        outcomes: string[]
        tokenAfter: string | null
        monitor: AuthEventType[]
    }
}

const ok = (data: unknown = { ok: true }): FakeReply => ({ status: 200, data })
const unauthorized: FakeReply = { status: 401, data: { message: 'unauthorized' } }
const acceptsOnly = (token: string) => (auth: string | null) => (auth === `Bearer ${token}` ? ok() : unauthorized)

const { REFRESH_START: START, REFRESH_SUCCESS: SUCCESS, REFRESH_ERROR: ERROR, REQUEST_QUEUED: QUEUED } = AuthEventType

const PARITY: ParityScenario[] = [
    {
        name: 'no token → request goes out without Authorization',
        initialToken: null,
        data: () => ok(),
        refresh: ok({ accessToken: 'never' }),
        expected: {
            requests: ['GET /api/data -'],
            outcomes: ['resolved:200'],
            tokenAfter: null,
            monitor: [],
        },
    },
    {
        name: '401 → refresh → retry with the new token',
        initialToken: 'old',
        data: acceptsOnly('new'),
        refresh: ok({ accessToken: 'new' }),
        expected: {
            requests: ['GET /api/data Bearer old', 'POST /api/auth/refresh -', 'GET /api/data Bearer new'],
            outcomes: ['resolved:200'],
            tokenAfter: 'new',
            monitor: [START, SUCCESS],
        },
    },
    {
        name: 'three concurrent 401s → one refresh → three retries',
        initialToken: 'old',
        data: acceptsOnly('new'),
        refresh: ok({ access_token: 'new' }),
        concurrent: 3,
        expected: {
            requests: [
                'GET /api/data0 Bearer old', 'GET /api/data1 Bearer old', 'GET /api/data2 Bearer old',
                'POST /api/auth/refresh -',
                'GET /api/data0 Bearer new', 'GET /api/data1 Bearer new', 'GET /api/data2 Bearer new',
            ],
            outcomes: ['resolved:200', 'resolved:200', 'resolved:200'],
            tokenAfter: 'new',
            monitor: [START, QUEUED, QUEUED, SUCCESS],
        },
    },
    {
        name: 'refresh fails → original request rejects with the refresh error, tokens cleared',
        initialToken: 'old',
        data: acceptsOnly('new'),
        refresh: { status: 500, data: { message: 'down' } },
        expected: {
            requests: ['GET /api/data Bearer old', 'POST /api/auth/refresh -'],
            outcomes: ['rejected:500'],
            tokenAfter: null,
            monitor: [START, ERROR],
        },
    },
    {
        name: 'refresh response without a token → failure, tokens cleared',
        initialToken: 'old',
        data: acceptsOnly('new'),
        refresh: ok({ nothing: true }),
        expected: {
            requests: ['GET /api/data Bearer old', 'POST /api/auth/refresh -'],
            outcomes: ['rejected:No access token in refresh response'],
            tokenAfter: null,
            monitor: [START, ERROR],
        },
    },
    {
        name: 'still 401 after the refresh → rejects with that 401, no second refresh',
        initialToken: 'old',
        data: () => unauthorized,
        refresh: ok({ accessToken: 'new' }),
        expected: {
            requests: ['GET /api/data Bearer old', 'POST /api/auth/refresh -', 'GET /api/data Bearer new'],
            outcomes: ['rejected:401'],
            tokenAfter: 'new',
            monitor: [START, SUCCESS],
        },
    },
    {
        name: 'authMode public → no Authorization, a 401 does not refresh',
        initialToken: 'old',
        data: () => unauthorized,
        refresh: ok({ accessToken: 'new' }),
        authMode: 'public',
        expected: {
            requests: ['GET /api/data -'],
            outcomes: ['rejected:401'],
            tokenAfter: 'old',
            monitor: [],
        },
    },
    {
        name: 'authMode optional → token sent when present, a 401 does not refresh',
        initialToken: 'old',
        data: () => unauthorized,
        refresh: ok({ accessToken: 'new' }),
        authMode: 'optional',
        expected: {
            requests: ['GET /api/data Bearer old'],
            outcomes: ['rejected:401'],
            tokenAfter: 'old',
            monitor: [],
        },
    },
]

type ClientKind = 'legacy' | 'session'

function buildClient(kind: ClientKind): AxiosInstance {
    if (kind === 'legacy') {
        return createApiClient({ baseURL: '/api', authOptions: { refreshUrl: '/auth/refresh' } })
    }
    const session = createAuthSession({ refresh: { url: '/auth/refresh', baseURL: '/api' } })
    return createApiClient({ baseURL: '/api', authSession: session })
}

async function runScenario(kind: ClientKind, scenario: ParityScenario) {
    const concurrent = scenario.concurrent ?? 1
    const refreshGate = deferred<void>()
    let dataUnauthorized = 0

    const adapter = backend(async (config) => {
        if (fullUrl(config).endsWith('/auth/refresh')) {
            if (concurrent > 1) await refreshGate.promise
            return scenario.refresh
        }
        const auth = config.headers.get('Authorization')
        const reply = scenario.data(typeof auth === 'string' ? auth : null)
        if (reply.status === 401) dataUnauthorized++
        return reply
    })

    const client = buildClient(kind)
    tokenManager.clearTokens()
    if (scenario.initialToken) tokenManager.setTokens({ accessToken: scenario.initialToken })
    monitorEvents = []

    const config = scenario.authMode ? withAuthMode(scenario.authMode) : {}
    const paths = concurrent === 1 ? ['/data'] : Array.from({ length: concurrent }, (_, i) => `/data${i}`)
    const pending = Promise.allSettled(paths.map((path) => client.get(path, config)))

    if (concurrent > 1) {
        // Hold the refresh until every request has seen its 401 and joined the wait
        await vi.waitFor(() => expect(dataUnauthorized).toBe(concurrent))
        await new Promise((resolve) => setTimeout(resolve, 0))
        refreshGate.resolve()
    }

    const settled = await pending
    return {
        // Retry order of waiting requests is an implementation detail — compare as a set
        requests: adapter.calls.map(describeRequest).sort(),
        outcomes: settled.map(describeOutcome),
        tokenAfter: tokenManager.getAccessToken(),
        monitor: [...monitorEvents],
    }
}

describe('attach — parity with the legacy interceptor', () => {
    it.each(PARITY)('$name', async (scenario) => {
        const expected = { ...scenario.expected, requests: [...scenario.expected.requests].sort() }

        const legacy = await runScenario('legacy', scenario)
        const session = await runScenario('session', scenario)

        expect(legacy).toEqual(expected)
        expect(session).toEqual(expected)
    })
})

// ---------------------------------------------------------------------------
// (a) Attaching an axios instance
// ---------------------------------------------------------------------------

describe('attach — instance behaviour', () => {
    it('sends Authorization: Bearer <token> on a default-auth request', async () => {
        const adapter = backend(() => ok())
        tokenManager.setTokens({ accessToken: 'tok' })
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })
        const client = createApiClient({ authSession: session })

        await client.get('/x')
        expect(adapter.calls[0].headers.get('Authorization')).toBe('Bearer tok')
    })

    it('passes the stale token from the failed request to the session', async () => {
        backend((config) => (fullUrl(config).endsWith('/auth/refresh') ? ok({ accessToken: 'new' }) : acceptsOnly('new')(
            (config.headers.get('Authorization') as string | undefined) ?? null,
        )))
        tokenManager.setTokens({ accessToken: 'old' })
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })
        const onStart = vi.fn()
        session.on('refreshStart', onStart)

        await createApiClient({ authSession: session }).get('/x')
        expect(onStart).toHaveBeenCalledWith({ staleAccessToken: 'old' })
    })

    it('authSession takes precedence over authOptions and warns in development', async () => {
        vi.stubEnv('NODE_ENV', 'development')
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const adapter = backend((config) => {
            if (fullUrl(config) === '/session/refresh') return ok({ accessToken: 'new' })
            return acceptsOnly('new')((config.headers.get('Authorization') as string | undefined) ?? null)
        })
        tokenManager.setTokens({ accessToken: 'old' })
        const session = createAuthSession({ refresh: { url: '/session/refresh' } })

        const client = createApiClient({ authSession: session, authOptions: { refreshUrl: '/legacy/refresh' } })
        await client.get('/x')

        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toContain('`authSession` is set')
        expect(adapter.calls.map((c) => fullUrl(c))).toEqual(['/x', '/session/refresh', '/x'])
    })

    it('also warns for withAuth: false next to authSession, but not outside development', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const session = createAuthSession({ refresh: { url: '/r' } })

        createApiClient({ authSession: session, withAuth: false })
        expect(warn).not.toHaveBeenCalled()

        vi.stubEnv('NODE_ENV', 'development')
        createApiClient({ authSession: session, withAuth: false })
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('does not change the tokenManager storage configuration', () => {
        const spy = vi.spyOn(tokenManager, 'setStorage')
        createApiClient({ authSession: createAuthSession({ refresh: { url: '/r' } }) })
        expect(spy).not.toHaveBeenCalled()
    })

    it("keeps axios' own `auth` (HTTP Basic) option working next to authSession", () => {
        const client = createApiClient({
            authSession: createAuthSession({ refresh: { url: '/r' } }),
            auth: { username: 'u', password: 'p' },
        })
        expect(client.defaults.auth).toEqual({ username: 'u', password: 'p' })
    })

    it('reports queued requests to the auth monitor with their url', async () => {
        const monitor = vi.fn()
        setAuthMonitor(monitor)
        const gate = deferred<void>()
        let unauthorized401 = 0
        backend(async (config) => {
            if (fullUrl(config).endsWith('/auth/refresh')) { await gate.promise; return ok({ accessToken: 'new' }) }
            const reply = acceptsOnly('new')((config.headers.get('Authorization') as string | undefined) ?? null)
            if (reply.status === 401) unauthorized401++
            return reply
        })
        tokenManager.setTokens({ accessToken: 'old' })
        const client = createApiClient({ authSession: createAuthSession({ refresh: { url: '/auth/refresh' } }) })

        const pending = Promise.all([client.get('/first'), client.get('/second')])
        await vi.waitFor(() => expect(unauthorized401).toBe(2))
        await new Promise((resolve) => setTimeout(resolve, 0))
        gate.resolve()
        await pending

        const queued = monitor.mock.calls.filter(([type]) => type === QUEUED)
        expect(queued).toHaveLength(1)
        expect(queued[0][1]).toMatchObject({ url: '/second' })
    })

    it('flags the devtools record of a request retried after a refresh', async () => {
        __devtoolsInternals().setExpected(true)
        const flag = vi.spyOn(devtoolsBridge, 'onRequestAuthRetry')
        backend((config) => (fullUrl(config).endsWith('/auth/refresh') ? ok({ accessToken: 'new' }) : acceptsOnly('new')(
            (config.headers.get('Authorization') as string | undefined) ?? null,
        )))
        tokenManager.setTokens({ accessToken: 'old' })
        const client = createApiClient({ authSession: createAuthSession({ refresh: { url: '/auth/refresh' } }) })

        await client.get('/x', { _devtoolsRequestId: 'req_42' } as AxiosRequestConfig)
        expect(flag).toHaveBeenCalledWith('req_42')
    })

    it('a function transport using an attached instance with authMode public fails instead of hanging', async () => {
        backend(() => unauthorized)
        tokenManager.setTokens({ accessToken: 'old' })
        let client!: AxiosInstance
        const session = createAuthSession({
            refresh: async () => {
                const res = await client.post('/auth/refresh', {}, withAuthMode('public'))
                return { accessToken: (res.data as { accessToken: string }).accessToken }
            },
        })
        client = createApiClient({ authSession: session })

        await expect(client.get('/x')).rejects.toMatchObject({ response: { status: 401 } })
        expect(tokenManager.getAccessToken()).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// (c) + (d) Several instances, one session
// ---------------------------------------------------------------------------

describe('attach — several instances share one session', () => {
    it('two instances with concurrent 401s trigger exactly one refresh', async () => {
        const gate = deferred<void>()
        let unauthorized401 = 0
        const adapter = backend(async (config) => {
            if (fullUrl(config) === 'https://insights.example/auth/refresh') {
                await gate.promise
                return ok({ accessToken: 'new' })
            }
            const reply = acceptsOnly('new')((config.headers.get('Authorization') as string | undefined) ?? null)
            if (reply.status === 401) unauthorized401++
            return reply
        })
        tokenManager.setTokens({ accessToken: 'old' })
        const session = createAuthSession({ refresh: { url: '/auth/refresh', baseURL: 'https://insights.example' } })
        const insights = createApiClient({ baseURL: 'https://insights.example', authSession: session })
        const tools = createApiClient({ baseURL: 'https://tools.example', authSession: session })

        const pending = Promise.all([insights.get('/brands'), tools.get('/brands')])
        await vi.waitFor(() => expect(unauthorized401).toBe(2))
        await new Promise((resolve) => setTimeout(resolve, 0))
        gate.resolve()
        const [a, b] = await pending

        expect(a.status).toBe(200)
        expect(b.status).toBe(200)
        expect(adapter.calls.filter((c) => fullUrl(c).endsWith('/auth/refresh'))).toHaveLength(1)
    })

    it("refreshes through the session's backend and retries on the instance's own baseURL", async () => {
        const adapter = backend((config) => {
            if (fullUrl(config) === 'https://insights.example/auth/refresh') return ok({ accessToken: 'new' })
            return acceptsOnly('new')((config.headers.get('Authorization') as string | undefined) ?? null)
        })
        tokenManager.setTokens({ accessToken: 'old' })
        const session = createAuthSession({ refresh: { url: '/auth/refresh', baseURL: 'https://insights.example' } })
        const tools = createApiClient({ baseURL: 'https://tools.example', authSession: session })

        await tools.get('/brands')

        expect(adapter.calls.map(describeRequest)).toEqual([
            'GET https://tools.example/brands Bearer old',
            'POST https://insights.example/auth/refresh -',
            'GET https://tools.example/brands Bearer new',
        ])
    })

    it('a refresh triggered by session.refresh() is shared with an instance 401', async () => {
        const gate = deferred<void>()
        const adapter = backend(async (config) => {
            if (fullUrl(config).endsWith('/auth/refresh')) { await gate.promise; return ok({ accessToken: 'new' }) }
            return acceptsOnly('new')((config.headers.get('Authorization') as string | undefined) ?? null)
        })
        tokenManager.setTokens({ accessToken: 'old' })
        const session = createAuthSession({ refresh: { url: '/auth/refresh' } })
        const client = createApiClient({ authSession: session })

        const manual = session.refresh()
        const request = client.get('/x')
        await vi.waitFor(() => expect(adapter.calls.length).toBe(2))
        await new Promise((resolve) => setTimeout(resolve, 0))
        gate.resolve()

        await expect(manual).resolves.toBe('new')
        await expect(request).resolves.toMatchObject({ status: 200 })
        expect(adapter.calls.filter((c) => fullUrl(c).endsWith('/auth/refresh'))).toHaveLength(1)
    })
})
