/**
 * useApiState — full coverage
 *
 * Covers:
 *  - initial state (defaults, initialData, initialLoading)
 *  - mutate (direct value, updater fn, clears error, sets response)
 *  - setError / setLoading / setStatusCode
 *  - reset (restores all fields to initial values)
 */

import { describe, it, expect } from 'vitest'
import type { AxiosResponse } from 'axios'
import { useApiState } from './useApiState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeResponse<T>(data: T, status = 200): AxiosResponse<T> {
    return { data, status, statusText: 'OK', headers: {}, config: {} as any }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('useApiState — initial state', () => {
    it('data is null by default', () => {
        const { data } = useApiState()
        expect(data.value).toBeNull()
    })

    it('accepts initialData', () => {
        const { data } = useApiState([1, 2, 3])
        expect(data.value).toEqual([1, 2, 3])
    })

    it('loading is false by default', () => {
        const { loading } = useApiState()
        expect(loading.value).toBe(false)
    })

    it('initialLoading: true sets loading to true', () => {
        const { loading } = useApiState(null, { initialLoading: true })
        expect(loading.value).toBe(true)
    })

    it('error is null initially', () => {
        const { error } = useApiState()
        expect(error.value).toBeNull()
    })

    it('statusCode is null initially', () => {
        const { statusCode } = useApiState()
        expect(statusCode.value).toBeNull()
    })

    it('response is null initially', () => {
        const { response } = useApiState()
        expect(response.value).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// mutate
// ---------------------------------------------------------------------------

describe('useApiState — mutate', () => {
    it('direct value replaces data', () => {
        const { data, mutate } = useApiState<string>()
        mutate('hello')
        expect(data.value).toBe('hello')
    })

    it('updater function receives previous value and sets result', () => {
        const { data, mutate } = useApiState<number>(10)
        mutate(prev => (prev ?? 0) + 5)
        expect(data.value).toBe(15)
    })

    it('mutate() clears error', () => {
        const { error, setError, mutate } = useApiState<string>()
        setError({ message: 'oops', status: 500 })
        mutate('ok')
        expect(error.value).toBeNull()
    })

    it('mutate(null) sets data to null', () => {
        const { data, mutate } = useApiState<string>('hello')
        mutate(null)
        expect(data.value).toBeNull()
    })

    it('mutate() with fullResponse sets the response ref', () => {
        const { response, mutate } = useApiState<string>()
        const res = fakeResponse('ok')
        mutate('ok', res)
        // Vue ref() deep-proxies plain objects, so use toEqual not toBe
        expect(response.value).toEqual(res)
    })

    it('mutate() without fullResponse does not clear existing response', () => {
        const { response, mutate } = useApiState<string>()
        const res = fakeResponse('first')
        mutate('first', res)
        mutate('second')                       // no fullResponse arg
        expect(response.value).toEqual(res)    // still the old response
    })

    it('updater receives null when data was never set', () => {
        const received: Array<string | null> = []
        const { mutate } = useApiState<string>()
        mutate(prev => { received.push(prev); return prev })
        expect(received[0]).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe('useApiState — setError', () => {
    it('sets error ref', () => {
        const { error, setError } = useApiState()
        setError({ message: 'Not found', status: 404 })
        expect(error.value).toEqual({ message: 'Not found', status: 404 })
    })

    it('setError(null) clears error', () => {
        const { error, setError } = useApiState()
        setError({ message: 'err', status: 500 })
        setError(null)
        expect(error.value).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// setLoading
// ---------------------------------------------------------------------------

describe('useApiState — setLoading', () => {
    it('setLoading(true) sets loading to true', () => {
        const { loading, setLoading } = useApiState()
        setLoading(true)
        expect(loading.value).toBe(true)
    })

    it('setLoading(false) clears loading', () => {
        const { loading, setLoading } = useApiState(null, { initialLoading: true })
        setLoading(false)
        expect(loading.value).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// setStatusCode
// ---------------------------------------------------------------------------

describe('useApiState — setStatusCode', () => {
    it('updates statusCode ref', () => {
        const { statusCode, setStatusCode } = useApiState()
        setStatusCode(201)
        expect(statusCode.value).toBe(201)
    })

    it('setStatusCode(null) clears statusCode', () => {
        const { statusCode, setStatusCode } = useApiState()
        setStatusCode(200)
        setStatusCode(null)
        expect(statusCode.value).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('useApiState — reset', () => {
    it('restores initialData', () => {
        const { data, mutate, reset } = useApiState<string>('original')
        mutate('changed')
        reset()
        expect(data.value).toBe('original')
    })

    it('restores null when no initialData was provided', () => {
        const { data, mutate, reset } = useApiState<string>()
        mutate('something')
        reset()
        expect(data.value).toBeNull()
    })

    it('sets loading to false', () => {
        const { loading, setLoading, reset } = useApiState()
        setLoading(true)
        reset()
        expect(loading.value).toBe(false)
    })

    it('clears error', () => {
        const { error, setError, reset } = useApiState()
        setError({ message: 'err', status: 500 })
        reset()
        expect(error.value).toBeNull()
    })

    it('clears statusCode', () => {
        const { statusCode, setStatusCode, reset } = useApiState()
        setStatusCode(500)
        reset()
        expect(statusCode.value).toBeNull()
    })

    it('clears response', () => {
        const { response, mutate, reset } = useApiState<string>()
        mutate('ok', fakeResponse('ok'))
        reset()
        expect(response.value).toBeNull()
    })
})
