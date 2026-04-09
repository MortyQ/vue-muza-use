/**
 * useApi — baseline coverage for behaviours not exercised in useApi.test.ts
 *
 * Covers:
 *  - state (statusCode, response ref, loading lifecycle, reset)
 *  - mutate (direct value, updater fn, clears error)
 *  - callbacks (onBefore, onSuccess, onFinish, onError, skipErrorNotification)
 *  - url forms (ref<string>, getter fn)
 *  - execute() override config / data-as-ref unwrapping
 *  - authMode forwarded to axios config
 *  - abort (swallows error, does not call globalOnError)
 *  - known issues (it.todo)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { defineComponent, ref, type MaybeRefOrGetter } from 'vue'
import { mount } from '@vue/test-utils'
import type { AxiosInstance } from 'axios'
import { useApi } from './useApi'
import { createApi } from './plugin'
import type { UseApiOptions, ApiPluginOptions, UseApiReturn } from './types'

// ---------------------------------------------------------------------------
// Shared mock & helpers
// ---------------------------------------------------------------------------

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

function mountApi<T = unknown>(
    options: UseApiOptions<T> = {},
    apiOptions: Partial<ApiPluginOptions> = {},
    url?: MaybeRefOrGetter<string | undefined>,
) {
    let result: UseApiReturn<T, unknown>
    const Comp = defineComponent({
        setup() {
            result = useApi(url ?? '/test', options)
            return () => null
        },
    })
    const wrapper = mount(Comp, {
        global: { plugins: [createApi({ axios: mockAxios, ...apiOptions })] },
    })
    return { result: result!, wrapper }
}

function axiosError(status: number, message = 'Error') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    })
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

describe('useApi — state', () => {
    beforeEach(() => vi.clearAllMocks())

    it('execute() returns the response data value', async () => {
        const payload = { id: 1, name: 'Alice' }
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: payload, status: 200 })
        const { result } = mountApi()
        const returned = await result.execute()
        expect(returned).toEqual(payload)
        expect(result.data.value).toEqual(payload)
    })

    it('execute() returns null and sets error on failure', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(axiosError(500))
        const { result } = mountApi()
        const returned = await result.execute()
        expect(returned).toBeNull()
        expect(result.error.value).toBeTruthy()
        expect(result.error.value?.status).toBe(500)
    })

    it('loading is true while request is in-flight and false after success', async () => {
        let resolve!: (v: unknown) => void
        ;(mockAxios.request as unknown as Mock).mockReturnValue(
            new Promise(r => { resolve = r }),
        )
        const { result } = mountApi()
        const p = result.execute()
        expect(result.loading.value).toBe(true)
        resolve({ data: {}, status: 200 })
        await p
        expect(result.loading.value).toBe(false)
    })

    it('loading is false after a failed request', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(new Error('fail'))
        const { result } = mountApi()
        await result.execute()
        expect(result.loading.value).toBe(false)
    })

    it('statusCode is set from a successful response', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 201 })
        const { result } = mountApi()
        await result.execute()
        expect(result.statusCode.value).toBe(201)
    })

    it('statusCode is set from an error response', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(axiosError(422))
        const { result } = mountApi()
        await result.execute()
        expect(result.statusCode.value).toBe(422)
    })

    it('response ref holds the full AxiosResponse object', async () => {
        const axiosResp = { data: { id: 1 }, status: 200, headers: { 'x-request-id': 'abc' } }
        ;(mockAxios.request as unknown as Mock).mockResolvedValue(axiosResp)
        const { result } = mountApi()
        await result.execute()
        expect(result.response.value).toStrictEqual(axiosResp)
    })

    it('reset() clears data, error, statusCode and sets loading to false', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: { id: 1 }, status: 200 })
        const { result } = mountApi()
        await result.execute()
        expect(result.data.value).toBeTruthy()

        result.reset()

        expect(result.data.value).toBeNull()
        expect(result.error.value).toBeNull()
        expect(result.statusCode.value).toBeNull()
        expect(result.loading.value).toBe(false)
    })

    it('error is cleared when a subsequent request succeeds', async () => {
        ;(mockAxios.request as unknown as Mock)
            .mockRejectedValueOnce(axiosError(500))
            .mockResolvedValueOnce({ data: { ok: true }, status: 200 })
        const { result } = mountApi()
        await result.execute()
        expect(result.error.value).toBeTruthy()
        await result.execute()
        expect(result.error.value).toBeNull()
        expect(result.data.value).toEqual({ ok: true })
    })
})

// ---------------------------------------------------------------------------
// Mutate
// ---------------------------------------------------------------------------

describe('useApi — mutate', () => {
    beforeEach(() => vi.clearAllMocks())

    it('mutate() with a direct value replaces data', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: { id: 1, name: 'Alice' }, status: 200 })
        const { result } = mountApi()
        await result.execute()
        result.mutate({ id: 1, name: 'Bob' } as any)
        expect((result.data.value as any)?.name).toBe('Bob')
    })

    it('mutate() with an updater function receives the previous value', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: { count: 5 }, status: 200 })
        const { result } = mountApi()
        await result.execute()
        result.mutate((prev: any) => ({ count: prev.count + 10 }))
        expect((result.data.value as any)?.count).toBe(15)
    })

    it('mutate() clears error automatically', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(new Error('fail'))
        const { result } = mountApi()
        await result.execute()
        expect(result.error.value).not.toBeNull()
        result.mutate({ recovered: true } as any)
        expect(result.error.value).toBeNull()
    })

    it('mutate(null) sets data to null', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: { id: 1 }, status: 200 })
        const { result } = mountApi()
        await result.execute()
        expect(result.data.value).not.toBeNull()
        result.mutate(null)
        expect(result.data.value).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

describe('useApi — callbacks', () => {
    beforeEach(() => vi.clearAllMocks())

    it('onBefore fires synchronously before the request is sent', async () => {
        const order: string[] = []
        ;(mockAxios.request as unknown as Mock).mockImplementation(() => {
            order.push('request')
            return Promise.resolve({ data: {}, status: 200 })
        })
        const { result } = mountApi({ onBefore: () => order.push('before') })
        await result.execute()
        expect(order).toEqual(['before', 'request'])
    })

    it('onSuccess fires with the full AxiosResponse on success', async () => {
        const response = { data: { id: 1 }, status: 200 }
        ;(mockAxios.request as unknown as Mock).mockResolvedValue(response)
        const onSuccess = vi.fn()
        const { result } = mountApi({ onSuccess })
        await result.execute()
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).toHaveBeenCalledWith(response)
    })

    it('onFinish fires after a successful request', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const onFinish = vi.fn()
        const { result } = mountApi({ onFinish })
        await result.execute()
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it('onFinish fires after a failed request', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(new Error('fail'))
        const onFinish = vi.fn()
        const { result } = mountApi({ onFinish })
        await result.execute()
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it('onError fires with a normalised ApiError', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(axiosError(400, 'Bad Request'))
        const onError = vi.fn()
        const { result } = mountApi({ onError })
        await result.execute()
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ status: 400, message: 'Bad Request' }),
        )
    })

    it('skipErrorNotification suppresses the global onError handler', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(new Error('fail'))
        const globalOnError = vi.fn()
        const { result } = mountApi(
            { skipErrorNotification: true },
            { onError: globalOnError },
        )
        await result.execute()
        expect(globalOnError).not.toHaveBeenCalled()
        expect(result.error.value).not.toBeNull() // local error IS still set
    })

    it('globalOnError fires when skipErrorNotification is false (default)', async () => {
        ;(mockAxios.request as unknown as Mock).mockRejectedValue(axiosError(503))
        const globalOnError = vi.fn()
        const { result } = mountApi({}, { onError: globalOnError })
        await result.execute()
        expect(globalOnError).toHaveBeenCalledOnce()
        expect(globalOnError).toHaveBeenCalledWith(
            expect.objectContaining({ status: 503 }),
            expect.anything(),
        )
    })
})

// ---------------------------------------------------------------------------
// URL forms
// ---------------------------------------------------------------------------

describe('useApi — url forms', () => {
    beforeEach(() => vi.clearAllMocks())

    it('accepts url as a reactive ref<string>', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const urlRef = ref('/from-ref')
        const { result } = mountApi({}, {}, urlRef)
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/from-ref' }),
        )
    })

    it('accepts url as a getter () => string', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const id = ref(42)
        const { result } = mountApi({}, {}, () => `/items/${id.value}`)
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/items/42' }),
        )
    })

    it('getter url reacts to ref changes', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const id = ref(1)
        const { result } = mountApi({}, {}, () => `/users/${id.value}`)

        await result.execute()
        expect(mockAxios.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/users/1' }))

        id.value = 99
        await result.execute()
        expect(mockAxios.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/users/99' }))
    })
})

// ---------------------------------------------------------------------------
// Config merging and data unwrapping
// ---------------------------------------------------------------------------

describe('useApi — execute() config override', () => {
    beforeEach(() => vi.clearAllMocks())

    it('execute(config) overrides data and params for that call only', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const { result } = mountApi({ method: 'POST', data: { original: true } })
        await result.execute({ data: { overridden: true }, params: { page: 2 } })
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ data: { overridden: true }, params: { page: 2 } }),
        )
    })

    it('data option as a ref<object> is unwrapped before sending', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const body = ref({ name: 'Alice' })
        const { result } = mountApi({ method: 'POST', data: body })
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ data: { name: 'Alice' } }),
        )
    })

    it('updating a ref body is reflected in the next execute() call', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const body = ref({ name: 'Alice' })
        const { result } = mountApi({ method: 'POST', data: body })

        await result.execute()
        expect(mockAxios.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { name: 'Alice' } }))

        body.value = { name: 'Bob' }
        await result.execute()
        expect(mockAxios.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { name: 'Bob' } }))
    })
})

// ---------------------------------------------------------------------------
// authMode forwarding
// ---------------------------------------------------------------------------

describe('useApi — authMode', () => {
    beforeEach(() => vi.clearAllMocks())

    it("authMode: 'default' is forwarded in the axios request config", async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const { result } = mountApi({ authMode: 'default' })
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ authMode: 'default' }),
        )
    })

    it("authMode: 'public' is forwarded in the axios request config", async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const { result } = mountApi({ authMode: 'public' })
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ authMode: 'public' }),
        )
    })

    it("authMode: 'optional' is forwarded in the axios request config", async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const { result } = mountApi({ authMode: 'optional' })
        await result.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ authMode: 'optional' }),
        )
    })

    it('execute(config) can override authMode per-call', async () => {
        ;(mockAxios.request as unknown as Mock).mockResolvedValue({ data: {}, status: 200 })
        const { result } = mountApi({ authMode: 'default' })
        await result.execute({ authMode: 'public' })
        expect(mockAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({ authMode: 'public' }),
        )
    })
})

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

describe('useApi — abort', () => {
    beforeEach(() => vi.clearAllMocks())

    it('abort() swallows the cancellation — error stays null', async () => {
        let rejectReq!: (e: unknown) => void
        ;(mockAxios.request as unknown as Mock).mockReturnValue(
            new Promise((_, rej) => { rejectReq = rej }),
        )
        const { result } = mountApi()
        const p = result.execute()
        result.abort()
        rejectReq(Object.assign(new Error('canceled'), { isAxiosError: true, code: 'ERR_CANCELED' }))
        await p
        expect(result.error.value).toBeNull()
    })

    it('abort() does not invoke the global onError handler', async () => {
        let rejectReq!: (e: unknown) => void
        ;(mockAxios.request as unknown as Mock).mockReturnValue(
            new Promise((_, rej) => { rejectReq = rej }),
        )
        const globalOnError = vi.fn()
        const { result } = mountApi({}, { onError: globalOnError })
        const p = result.execute()
        result.abort()
        rejectReq(Object.assign(new Error('canceled'), { isAxiosError: true, code: 'ERR_CANCELED' }))
        await p
        expect(globalOnError).not.toHaveBeenCalled()
    })

    it('abort() does not invoke the local onError callback', async () => {
        let rejectReq!: (e: unknown) => void
        ;(mockAxios.request as unknown as Mock).mockReturnValue(
            new Promise((_, rej) => { rejectReq = rej }),
        )
        const localOnError = vi.fn()
        const { result } = mountApi({ onError: localOnError })
        const p = result.execute()
        result.abort()
        rejectReq(Object.assign(new Error('canceled'), { isAxiosError: true, code: 'ERR_CANCELED' }))
        await p
        expect(localOnError).not.toHaveBeenCalled()
    })

    it.todo('abort() during in-flight request should reset loading to false (currently requires reset() call)')
    it.todo('global useAbortController.abort() should cancel all subscribed requests simultaneously')
})

// ---------------------------------------------------------------------------
// Known issues — documented as todo
// ---------------------------------------------------------------------------

describe('useApi — known issues (todo)', () => {
    it.todo('debounceFn: verify superseded Promises are garbage collected after 100 rapid calls (no memory accumulation)')
})
