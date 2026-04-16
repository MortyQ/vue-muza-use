/**
 * useApi — ignoreUpdates & useGlobalAbort
 *
 * ignoreUpdates covers:
 *  - suppresses watch-triggered execution when refs change inside updater
 *  - the updater still executes (side effects happen)
 *  - after ignoreUpdates, subsequent ref changes trigger normally
 *  - multiple refs changed inside one ignoreUpdates → still suppressed
 *
 * useGlobalAbort covers:
 *  - when useGlobalAbort: true (default), a global abort() cancels the in-flight request
 *  - when useGlobalAbort: false, global abort() does NOT cancel the request
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { AxiosInstance } from 'axios'
import { useApi } from './useApi'
import { useAbortController } from './composables/useAbortController'
import { createApi } from './plugin'

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

// resetAllMocks (not clearAllMocks) is required here: clearAllMocks only resets call history,
// while resetAllMocks also clears the mockResolvedValueOnce queue. Without this, leftover
// once-values from earlier tests intercept mockImplementation calls in later tests.
beforeEach(() => vi.resetAllMocks())

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyUseApiReturn = ReturnType<typeof useApi>

function mountWithWatch(watchSources: NonNullable<Parameters<typeof useApi>[1]>['watch']): AnyUseApiReturn {
    let api!: AnyUseApiReturn
    mount(
        defineComponent({
            setup() {
                api = useApi('/test', { watch: watchSources })
                return () => null
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios })] } },
    )
    return api
}

function successOnce() {
    ;(mockAxios.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: 'ok', status: 200 })
}

// ---------------------------------------------------------------------------
// ignoreUpdates
// ---------------------------------------------------------------------------

describe('useApi — ignoreUpdates', () => {
    it('ref change inside ignoreUpdates does NOT trigger a request', () => {
        const filter = ref('a')
        const api = mountWithWatch([filter])

        vi.clearAllMocks()
        api.ignoreUpdates(() => { filter.value = 'b' })

        // watch has flush: 'sync', so if it fired, axios.request would be called now
        expect(mockAxios.request).not.toHaveBeenCalled()
    })

    it('normal ref change outside ignoreUpdates triggers a request', () => {
        successOnce()
        const filter = ref('a')
        mountWithWatch([filter])

        vi.clearAllMocks()
        successOnce()
        filter.value = 'c'

        expect(mockAxios.request).toHaveBeenCalledOnce()
    })

    it('ignoreUpdates() still executes the updater function', () => {
        const filter = ref('original')
        const api = mountWithWatch([filter])

        api.ignoreUpdates(() => { filter.value = 'mutated' })

        expect(filter.value).toBe('mutated')
    })

    it('after ignoreUpdates, subsequent ref changes trigger normally', () => {
        const filter = ref('a')
        const api = mountWithWatch([filter])

        // suppressed change
        api.ignoreUpdates(() => { filter.value = 'b' })
        vi.clearAllMocks()

        // normal change — should trigger
        successOnce()
        filter.value = 'c'

        expect(mockAxios.request).toHaveBeenCalledOnce()
    })

    it('multiple refs changed inside one ignoreUpdates are all suppressed', () => {
        const a = ref(1)
        const b = ref(2)
        const api = mountWithWatch([a, b])

        vi.clearAllMocks()
        api.ignoreUpdates(() => {
            a.value = 10
            b.value = 20
        })

        expect(mockAxios.request).not.toHaveBeenCalled()
    })

    it('ignoreUpdates is a no-op when no watch option is configured', () => {
        let api!: AnyUseApiReturn
        mount(
            defineComponent({
                setup() {
                    api = useApi('/test')  // no watch
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        )

        expect(() => api.ignoreUpdates(() => {})).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// useGlobalAbort
// ---------------------------------------------------------------------------

describe('useApi — useGlobalAbort', () => {
    it('global abort() cancels a request with useGlobalAbort: true (default)', () => {
        // Capture the global signal BEFORE execute() runs so we can verify it's aborted later
        const { abort, getSignal } = useAbortController()
        const globalSignal = getSignal()

        let capturedSignal: AbortSignal | undefined
        ;(mockAxios.request as ReturnType<typeof vi.fn>).mockImplementation((cfg: any) => {
            capturedSignal = cfg.signal
            return new Promise(() => {}) // hang — never resolves
        })

        // immediate: true → execute() is called inside useApi() setup, axios.request() fires
        // synchronously before the first await, so capturedSignal is set by the time mount() returns
        mount(
            defineComponent({
                setup() {
                    useApi('/test', { useGlobalAbort: true, immediate: true })
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        )

        expect(capturedSignal).toBeDefined()
        expect(capturedSignal!.aborted).toBe(false)

        // abort() fires the event listener synchronously → per-request controller.abort() is called
        abort()

        expect(globalSignal.aborted).toBe(true)     // global signal aborted
        expect(capturedSignal!.aborted).toBe(true)  // per-request signal aborted via the listener
    })

    it('useGlobalAbort: false — global abort does NOT cancel the request', () => {
        const { abort } = useAbortController()

        let capturedSignal: AbortSignal | undefined
        ;(mockAxios.request as ReturnType<typeof vi.fn>).mockImplementation((cfg: any) => {
            capturedSignal = cfg.signal
            return new Promise(() => {})
        })

        let api!: AnyUseApiReturn
        mount(
            defineComponent({
                setup() {
                    api = useApi('/test', { useGlobalAbort: false })
                    return () => null
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        )

        api.execute()

        expect(capturedSignal).toBeDefined()
        abort()

        // Per-request signal is NOT connected to the global abort
        expect(capturedSignal!.aborted).toBe(false)
    })
})
