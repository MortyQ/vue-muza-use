/**
 * monitor — setAuthMonitor / trackAuthEvent / AuthEventType
 *
 * Covers:
 *  - setAuthMonitor registers a custom callback
 *  - trackAuthEvent calls the current monitor with type + payload
 *  - timestamp is always injected automatically
 *  - all AuthEventType enum values are distinct
 *  - replacing the monitor affects subsequent events only
 */

import { describe, it, expect, vi } from 'vitest'
import { setAuthMonitor, trackAuthEvent, AuthEventType } from './monitor'

// ---------------------------------------------------------------------------
// setAuthMonitor + trackAuthEvent
// ---------------------------------------------------------------------------

describe('setAuthMonitor / trackAuthEvent', () => {
    it('custom monitor is called when trackAuthEvent fires', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REFRESH_START)
        expect(fn).toHaveBeenCalledOnce()
    })

    it('monitor receives the correct event type', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REFRESH_SUCCESS)
        expect(fn).toHaveBeenCalledWith(AuthEventType.REFRESH_SUCCESS, expect.any(Object))
    })

    it('monitor receives the payload merged with a timestamp', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REQUEST_QUEUED, { queueSize: 3 })
        const [, payload] = fn.mock.calls[0]
        expect(payload.queueSize).toBe(3)
        expect(typeof payload.timestamp).toBe('string')
    })

    it('trackAuthEvent always injects a timestamp even with empty payload', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REFRESH_ERROR)
        const [, payload] = fn.mock.calls[0]
        expect(payload.timestamp).toBeDefined()
    })

    it('REFRESH_ERROR payload carries the error object', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        const err = new Error('token expired')
        trackAuthEvent(AuthEventType.REFRESH_ERROR, { error: err })
        const [, payload] = fn.mock.calls[0]
        expect(payload.error).toBe(err)
    })

    it('REQUEST_QUEUED payload carries the queueSize', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REQUEST_QUEUED, { queueSize: 5 })
        const [, payload] = fn.mock.calls[0]
        expect(payload.queueSize).toBe(5)
    })

    it('REFRESH_START payload carries the url', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        trackAuthEvent(AuthEventType.REFRESH_START, { url: '/auth/refresh' })
        const [, payload] = fn.mock.calls[0]
        expect(payload.url).toBe('/auth/refresh')
    })

    it('replacing the monitor affects only subsequent events', () => {
        const first = vi.fn()
        const second = vi.fn()

        setAuthMonitor(first)
        trackAuthEvent(AuthEventType.REFRESH_START)   // → first
        setAuthMonitor(second)
        trackAuthEvent(AuthEventType.REFRESH_SUCCESS) // → second

        expect(first).toHaveBeenCalledOnce()
        expect(second).toHaveBeenCalledOnce()
    })

    it('monitor is not called when trackAuthEvent is not invoked', () => {
        const fn = vi.fn()
        setAuthMonitor(fn)
        expect(fn).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// AuthEventType enum
// ---------------------------------------------------------------------------

describe('AuthEventType', () => {
    it('all four event type values are unique strings', () => {
        const values = Object.values(AuthEventType)
        const unique = new Set(values)
        expect(unique.size).toBe(values.length)
        expect(values.length).toBe(4)
    })

    it('REFRESH_START value is defined', () => {
        expect(AuthEventType.REFRESH_START).toBeDefined()
    })

    it('REFRESH_SUCCESS value is defined', () => {
        expect(AuthEventType.REFRESH_SUCCESS).toBeDefined()
    })

    it('REFRESH_ERROR value is defined', () => {
        expect(AuthEventType.REFRESH_ERROR).toBeDefined()
    })

    it('REQUEST_QUEUED value is defined', () => {
        expect(AuthEventType.REQUEST_QUEUED).toBeDefined()
    })
})
