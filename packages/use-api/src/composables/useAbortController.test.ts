/**
 * useAbortController — full coverage
 *
 * NOTE: useAbortController is a module-level singleton.
 * Tests that call abort() affect subsequent tests — each test that relies
 * on a specific abortCount should read the value before the call and check
 * the delta, not an absolute number.
 *
 * Covers:
 *  - getSignal() returns a valid, non-aborted AbortSignal
 *  - abort() marks current signal as aborted and creates a fresh controller
 *  - abortCount increments on every abort() call
 *  - isAbortError() correctly identifies AbortError DOMExceptions
 *  - singleton: two calls to useAbortController share the same state
 */

import { describe, it, expect } from 'vitest'
import { useAbortController } from './useAbortController'

// ---------------------------------------------------------------------------
// signal
// ---------------------------------------------------------------------------

describe('useAbortController — getSignal', () => {
    it('returns an AbortSignal', () => {
        const { getSignal } = useAbortController()
        expect(getSignal()).toBeInstanceOf(AbortSignal)
    })

    it('fresh signal is not aborted', () => {
        const { abort, getSignal } = useAbortController()
        // Ensure we start from a clean (post-abort) controller
        abort()
        expect(getSignal().aborted).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// abort
// ---------------------------------------------------------------------------

describe('useAbortController — abort', () => {
    it('abort() marks the captured signal as aborted', () => {
        const { abort, getSignal } = useAbortController()
        const signal = getSignal()
        abort()
        expect(signal.aborted).toBe(true)
    })

    it('after abort(), getSignal() returns a new non-aborted signal', () => {
        const { abort, getSignal } = useAbortController()
        abort()
        expect(getSignal().aborted).toBe(false)
    })

    it('abort() increments abortCount by 1', () => {
        const { abort, abortCount } = useAbortController()
        const before = abortCount.value
        abort()
        expect(abortCount.value).toBe(before + 1)
    })

    it('three abort() calls increment abortCount by 3', () => {
        const { abort, abortCount } = useAbortController()
        const before = abortCount.value
        abort()
        abort()
        abort()
        expect(abortCount.value).toBe(before + 3)
    })

    it('abortCount increments BEFORE the signal fires (handlers see new count)', () => {
        const { abort, abortCount, getSignal } = useAbortController()
        const signal = getSignal()
        let countOnAbort = -1
        signal.addEventListener('abort', () => { countOnAbort = abortCount.value })
        const before = abortCount.value
        abort()
        expect(countOnAbort).toBe(before + 1)
    })
})

// ---------------------------------------------------------------------------
// isAbortError
// ---------------------------------------------------------------------------

describe('useAbortController — isAbortError', () => {
    it('returns true for DOMException with name "AbortError"', () => {
        const { isAbortError } = useAbortController()
        const err = new DOMException('The user aborted a request.', 'AbortError')
        expect(isAbortError(err)).toBe(true)
    })

    it('returns false for a regular Error', () => {
        const { isAbortError } = useAbortController()
        expect(isAbortError(new Error('nope'))).toBe(false)
    })

    it('returns false for a DOMException with a different name', () => {
        const { isAbortError } = useAbortController()
        const err = new DOMException('Network failure', 'NetworkError')
        expect(isAbortError(err)).toBe(false)
    })

    it('returns false for a plain string', () => {
        const { isAbortError } = useAbortController()
        expect(isAbortError('abort')).toBe(false)
    })

    it('returns false for null', () => {
        const { isAbortError } = useAbortController()
        expect(isAbortError(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        const { isAbortError } = useAbortController()
        expect(isAbortError(undefined)).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// singleton behaviour
// ---------------------------------------------------------------------------

describe('useAbortController — singleton', () => {
    it('two instances share the same abort state', () => {
        const a = useAbortController()
        const b = useAbortController()
        const signal = a.getSignal()
        b.abort()
        expect(signal.aborted).toBe(true)
    })

    it('two instances share the same abortCount ref', () => {
        const a = useAbortController()
        const b = useAbortController()
        const before = a.abortCount.value
        b.abort()
        expect(a.abortCount.value).toBe(before + 1)
    })
})
