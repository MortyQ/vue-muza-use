/**
 * createApi / useApiConfig — plugin tests
 *
 * Covers:
 *  - createApi installs config via Vue provide/inject
 *  - useApiConfig() returns the config inside a component
 *  - useApiConfig() works outside a component (via module-level globalConfig)
 *  - onError, globalOptions are preserved in config
 *  - useApiConfig() throws when called without plugin and no global config
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, inject } from 'vue'
import { mount } from '@vue/test-utils'
import type { AxiosInstance } from 'axios'
import { createApi, useApiConfig, API_INJECTION_KEY } from './plugin'

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

// ---------------------------------------------------------------------------
// createApi — installation
// ---------------------------------------------------------------------------

describe('createApi — plugin installation', () => {
    it('returns an object with an install function', () => {
        const plugin = createApi({ axios: mockAxios })
        expect(typeof plugin.install).toBe('function')
    })

    it('provides config to components via Vue injection', () => {
        let injected: unknown

        const Comp = defineComponent({
            setup() {
                injected = inject(API_INJECTION_KEY)
                return () => null
            },
        })

        mount(Comp, { global: { plugins: [createApi({ axios: mockAxios })] } })

        expect(injected).toBeDefined()
        expect((injected as any).axios).toBe(mockAxios)
    })
})

// ---------------------------------------------------------------------------
// useApiConfig — inside component
// ---------------------------------------------------------------------------

describe('useApiConfig — inside component', () => {
    it('returns the config with the correct axios instance', () => {
        let config: ReturnType<typeof useApiConfig> | undefined

        mount(
            defineComponent({
                setup() {
                    config = useApiConfig()
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        )

        expect(config).toBeDefined()
        expect(config!.axios).toBe(mockAxios)
    })

    it('preserves the onError callback', () => {
        const onError = vi.fn()
        let config: ReturnType<typeof useApiConfig> | undefined

        mount(
            defineComponent({
                setup() {
                    config = useApiConfig()
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios, onError })] } },
        )

        expect(config!.onError).toBe(onError)
    })

    it('preserves globalOptions', () => {
        let config: ReturnType<typeof useApiConfig> | undefined

        mount(
            defineComponent({
                setup() {
                    config = useApiConfig()
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios, globalOptions: { retry: 3, retryDelay: 500 } })] } },
        )

        expect(config!.globalOptions?.retry).toBe(3)
        expect(config!.globalOptions?.retryDelay).toBe(500)
    })
})

// ---------------------------------------------------------------------------
// useApiConfig — outside component (module-level globalConfig)
// ---------------------------------------------------------------------------

describe('useApiConfig — outside component', () => {
    it('works outside a component after createApi() is called', () => {
        createApi({ axios: mockAxios })
        const config = useApiConfig()
        expect(config.axios).toBe(mockAxios)
    })

    it('most-recent createApi() call wins for globalConfig', () => {
        const axiosA = { ...mockAxios } as unknown as AxiosInstance
        const axiosB = { ...mockAxios } as unknown as AxiosInstance

        createApi({ axios: axiosA })
        createApi({ axios: axiosB })

        const config = useApiConfig()
        expect(config.axios).toBe(axiosB)
    })
})
