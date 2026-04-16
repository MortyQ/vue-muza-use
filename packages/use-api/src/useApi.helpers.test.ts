/**
 * HTTP method helpers — useApiGet / useApiPost / useApiPut / useApiPatch / useApiDelete
 *
 * Covers:
 *  - each helper forwards the correct HTTP method to axios
 *  - additional options (params, headers) are passed through
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import type { AxiosInstance } from 'axios'
import { useApiGet, useApiPost, useApiPut, useApiPatch, useApiDelete } from './useApi'
import { createApi } from './plugin'
import type { ApiPluginOptions } from './types'

// ---------------------------------------------------------------------------
// Shared mock
// ---------------------------------------------------------------------------

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyApiHelper = ReturnType<typeof useApiGet>

function mountHelper(
    helperFn: () => AnyApiHelper,
    apiOptions: Partial<ApiPluginOptions> = {},
): AnyApiHelper {
    let api!: AnyApiHelper
    mount(
        defineComponent({
            setup() {
                api = helperFn()
                return () => null
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios, ...apiOptions })] } },
    )
    return api
}

function successOnce() {
    ;(mockAxios.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, status: 200 })
}

// ---------------------------------------------------------------------------
// HTTP method forwarding
// ---------------------------------------------------------------------------

describe('HTTP method helpers — method forwarding', () => {
    it('useApiGet sends GET', async () => {
        successOnce()
        const api = mountHelper(() => useApiGet('/test'))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }))
    })

    it('useApiPost sends POST', async () => {
        successOnce()
        const api = mountHelper(() => useApiPost('/test'))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }))
    })

    it('useApiPut sends PUT', async () => {
        successOnce()
        const api = mountHelper(() => useApiPut('/test'))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }))
    })

    it('useApiPatch sends PATCH', async () => {
        successOnce()
        const api = mountHelper(() => useApiPatch('/test'))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }))
    })

    it('useApiDelete sends DELETE', async () => {
        successOnce()
        const api = mountHelper(() => useApiDelete('/test'))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE' }))
    })
})

// ---------------------------------------------------------------------------
// Option pass-through
// ---------------------------------------------------------------------------

describe('HTTP method helpers — option pass-through', () => {
    it('useApiGet forwards params option', async () => {
        successOnce()
        const api = mountHelper(() => useApiGet('/search', { params: { q: 'hello' } }))
        await api.execute()
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ params: { q: 'hello' } }))
    })

    it('useApiPost forwards data option via execute()', async () => {
        successOnce()
        const api = mountHelper(() => useApiPost<unknown, { name: string }>('/users'))
        await api.execute({ data: { name: 'Alice' } })
        expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Alice' } }))
    })

    it('useApiGet returns data on success', async () => {
        ;(mockAxios.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [1, 2, 3], status: 200 })
        const api = mountHelper(() => useApiGet<number[]>('/numbers'))
        const result = await api.execute()
        expect(result).toEqual([1, 2, 3])
    })

    it('useApiDelete returns null on success (no body expected)', async () => {
        ;(mockAxios.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, status: 204 })
        const api = mountHelper(() => useApiDelete('/users/1'))
        const result = await api.execute()
        expect(result).toBeNull()
    })
})
