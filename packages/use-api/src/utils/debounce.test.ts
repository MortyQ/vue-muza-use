/**
 * debounceFn — unit tests
 *
 * Verifies the contract:
 *   - Single call → resolves with the function result after delay
 *   - Rapid calls → only the last one resolves; earlier ones reject with DebounceCancelledError
 *   - DebounceCancelledError identity (instanceof, isDebounceCancelled flag)
 *   - Real error from the wrapped function is propagated on the final call
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounceFn, DebounceCancelledError } from './debounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// ---------------------------------------------------------------------------
// DebounceCancelledError identity
// ---------------------------------------------------------------------------

describe('DebounceCancelledError', () => {
    it('is an instance of Error', () => {
        expect(new DebounceCancelledError()).toBeInstanceOf(Error)
    })

    it('has isDebounceCancelled: true', () => {
        expect(new DebounceCancelledError().isDebounceCancelled).toBe(true)
    })

    it('has correct name and message', () => {
        const err = new DebounceCancelledError()
        expect(err.name).toBe('DebounceCancelledError')
        expect(err.message).toBe('Debounced call was superseded by a newer call')
    })
})

// ---------------------------------------------------------------------------
// Single call
// ---------------------------------------------------------------------------

describe('debounceFn — single call', () => {
    it('resolves with the wrapped function result after the delay', async () => {
        const fn = vi.fn().mockResolvedValue('hello')
        const debounced = debounceFn(fn, 200)

        const p = debounced()
        await vi.advanceTimersByTimeAsync(200)

        await expect(p).resolves.toBe('hello')
        expect(fn).toHaveBeenCalledOnce()
    })

    it('does NOT call the wrapped function before the delay elapses', async () => {
        const fn = vi.fn().mockResolvedValue('x')
        const debounced = debounceFn(fn, 300)

        debounced()
        await vi.advanceTimersByTimeAsync(100)

        expect(fn).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Two rapid calls
// ---------------------------------------------------------------------------

describe('debounceFn — two rapid calls', () => {
    it('first Promise rejects with DebounceCancelledError', async () => {
        const fn = vi.fn().mockResolvedValue('result')
        const debounced = debounceFn(fn, 200)

        const p1 = debounced()
        // Attach handler BEFORE the second call rejects p1 synchronously.
        const check1 = expect(p1).rejects.toBeInstanceOf(DebounceCancelledError)
        const p2 = debounced() // p1 is rejected here
        await check1

        await vi.advanceTimersByTimeAsync(200)
        await p2
    })

    it('second Promise resolves with the wrapped function result', async () => {
        const fn = vi.fn().mockResolvedValue('second-result')
        const debounced = debounceFn(fn, 200)

        // Silence the superseded promise so it doesn't produce an unhandled rejection.
        debounced().catch(() => {})
        const p2 = debounced()

        await vi.advanceTimersByTimeAsync(200)

        await expect(p2).resolves.toBe('second-result')
    })

    it('wrapped function is called exactly once', async () => {
        const fn = vi.fn().mockResolvedValue('x')
        const debounced = debounceFn(fn, 200)

        debounced().catch(() => {}) // silenced superseded call
        debounced()                 // final call

        await vi.advanceTimersByTimeAsync(200)
        await vi.advanceTimersByTimeAsync(0)

        expect(fn).toHaveBeenCalledOnce()
    })
})

// ---------------------------------------------------------------------------
// Three rapid calls
// ---------------------------------------------------------------------------

describe('debounceFn — three rapid calls', () => {
    it('first two Promises reject with DebounceCancelledError, third resolves', async () => {
        const fn = vi.fn().mockResolvedValue('final')
        const debounced = debounceFn(fn, 200)

        const p1 = debounced()
        // Attach each handler before the next call rejects the current one.
        const check1 = expect(p1).rejects.toBeInstanceOf(DebounceCancelledError)
        const p2 = debounced() // p1 rejected
        const check2 = expect(p2).rejects.toBeInstanceOf(DebounceCancelledError)
        const p3 = debounced() // p2 rejected

        await check1
        await check2

        await vi.advanceTimersByTimeAsync(200)
        await expect(p3).resolves.toBe('final')
    })

    it('wrapped function is called exactly once', async () => {
        const fn = vi.fn().mockResolvedValue('x')
        const debounced = debounceFn(fn, 100)

        debounced().catch(() => {}) // superseded
        debounced().catch(() => {}) // superseded
        debounced()                 // final call

        await vi.advanceTimersByTimeAsync(100)
        await vi.advanceTimersByTimeAsync(0)

        expect(fn).toHaveBeenCalledOnce()
    })
})

// ---------------------------------------------------------------------------
// Real error propagation
// ---------------------------------------------------------------------------

describe('debounceFn — error propagation', () => {
    it('propagates a real error from the wrapped function on the final call', async () => {
        const boom = new Error('real error')
        const fn = vi.fn().mockRejectedValue(boom)
        const debounced = debounceFn(fn, 100)

        const p = debounced()
        // Attach rejection handler BEFORE advancing timers so the rejection
        // never goes unhandled even momentarily.
        const assertion = expect(p).rejects.toBe(boom)
        await vi.advanceTimersByTimeAsync(100)
        await assertion
    })

    it('superseded call gets DebounceCancelledError even when final call throws a real error', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('boom'))
        const debounced = debounceFn(fn, 100)

        const p1 = debounced()
        // Attach handler on p1 BEFORE the second call rejects it synchronously.
        const check1 = expect(p1).rejects.toBeInstanceOf(DebounceCancelledError)
        const p2 = debounced() // p1 is rejected here
        await check1

        const check2 = expect(p2).rejects.toThrow('boom')
        await vi.advanceTimersByTimeAsync(100)
        await check2
    })
})

// ---------------------------------------------------------------------------
// Known limitations — it.todo
// ---------------------------------------------------------------------------

describe('debounceFn — known limitations (todo)', () => {
    it.todo('superseded Promises are garbage collected after 100 rapid calls (no memory accumulation in FinalizationRegistry)')
    it.todo('explicit cancel() API — not yet provided; supersede by calling again or recreate instance')
})
