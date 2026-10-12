import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

/** What a fake backend answers for one request. */
export interface FakeReply {
    status?: number
    data?: unknown
    headers?: Record<string, string>
}

export type FakeHandler = (config: InternalAxiosRequestConfig) => FakeReply | Promise<FakeReply>

/**
 * Build an axios adapter that answers from `handler` and records every request.
 * Non-2xx replies reject with an AxiosError carrying the response, like the real adapters.
 */
export function fakeAdapter(handler: FakeHandler): AxiosAdapter & { calls: InternalAxiosRequestConfig[] } {
    const calls: InternalAxiosRequestConfig[] = []
    const adapter = (async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        // Snapshot: a retried request reuses (and mutates) the same config object,
        // so recording the live object would rewrite the history of earlier calls
        calls.push({ ...config, headers: new AxiosHeaders(config.headers.toJSON()) })
        const reply = await handler(config)
        const response: AxiosResponse = {
            data: reply.data ?? null,
            status: reply.status ?? 200,
            statusText: '',
            headers: new AxiosHeaders(reply.headers ?? {}),
            config,
            request: {},
        }
        if (response.status >= 200 && response.status < 300) return response
        throw new AxiosError(
            `Request failed with status code ${response.status}`,
            AxiosError.ERR_BAD_REQUEST,
            config,
            {},
            response,
        )
    }) as AxiosAdapter & { calls: InternalAxiosRequestConfig[] }
    adapter.calls = calls
    return adapter
}

/**
 * Route every axios instance created from now on (including the session's private
 * refresh instance) through `handler`. Returns the adapter and a restore function.
 */
export function useGlobalFakeAdapter(handler: FakeHandler): {
    adapter: ReturnType<typeof fakeAdapter>
    restore: () => void
} {
    const previous = axios.defaults.adapter
    const adapter = fakeAdapter(handler)
    axios.defaults.adapter = adapter
    return { adapter, restore: () => { axios.defaults.adapter = previous } }
}

/** Full URL a recorded request was sent to (baseURL + url, without double slashes). */
export function fullUrl(config: InternalAxiosRequestConfig): string {
    const base = (config.baseURL ?? '').replace(/\/+$/, '')
    const path = config.url ?? ''
    if (/^https?:\/\//.test(path) || !base) return path
    return `${base}/${path.replace(/^\/+/, '')}`
}

/** A promise whose resolution the test controls. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}
