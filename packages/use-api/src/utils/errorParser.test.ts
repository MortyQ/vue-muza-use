/**
 * parseApiError — full coverage
 *
 * Covers:
 *  - Axios response errors: message priority (data.message → data.error → axios.message → fallback)
 *  - status, code, errors (validation), details fields
 *  - Non-Axios errors: regular Error, plain strings, null/undefined
 */

import { describe, it, expect } from 'vitest'
import { parseApiError } from './errorParser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAxiosError(status: number, data: Record<string, unknown>, message = 'Request failed') {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data },
    })
}

// ---------------------------------------------------------------------------
// Axios response errors
// ---------------------------------------------------------------------------

describe('parseApiError — Axios response errors', () => {
    it('uses data.message as the primary message source', () => {
        const err = makeAxiosError(400, { message: 'Bad request' })
        const result = parseApiError(err)
        expect(result.message).toBe('Bad request')
        expect(result.status).toBe(400)
    })

    it('falls back to data.error when data.message is absent', () => {
        const err = makeAxiosError(422, { error: 'Validation failed' })
        const result = parseApiError(err)
        expect(result.message).toBe('Validation failed')
        expect(result.status).toBe(422)
    })

    it('falls back to the axios Error.message when data has neither message nor error', () => {
        const err = makeAxiosError(503, {}, 'Service Unavailable')
        const result = parseApiError(err)
        expect(result.message).toBe('Service Unavailable')
        expect(result.status).toBe(503)
    })

    it('falls back to "Unknown Error" when all message sources are falsy', () => {
        // Empty string is falsy → reaches the final fallback
        const err = makeAxiosError(500, {}, '')
        const result = parseApiError(err)
        expect(result.message).toBe('Unknown Error')
    })

    it('includes code from data.code', () => {
        const err = makeAxiosError(400, { message: 'err', code: 'VALIDATION_ERROR' })
        expect(parseApiError(err).code).toBe('VALIDATION_ERROR')
    })

    it('includes errors field from data.errors (validation errors map)', () => {
        const errors = { email: ['required', 'invalid format'], name: ['too short'] }
        const err = makeAxiosError(422, { message: 'Unprocessable', errors })
        expect(parseApiError(err).errors).toEqual(errors)
    })

    it('includes details as the full raw response data object', () => {
        const data = { message: 'err', extra: 'meta', nested: { x: 1 } }
        const err = makeAxiosError(500, data)
        expect(parseApiError(err).details).toEqual(data)
    })

    it('code is undefined when data.code is absent', () => {
        const err = makeAxiosError(400, { message: 'err' })
        expect(parseApiError(err).code).toBeUndefined()
    })

    it('errors is undefined when data.errors is absent', () => {
        const err = makeAxiosError(400, { message: 'err' })
        expect(parseApiError(err).errors).toBeUndefined()
    })

    it('status 401 is preserved correctly', () => {
        const err = makeAxiosError(401, { message: 'Unauthorized' })
        expect(parseApiError(err).status).toBe(401)
    })

    it('status 404 is preserved correctly', () => {
        const err = makeAxiosError(404, { message: 'Not found' })
        expect(parseApiError(err).status).toBe(404)
    })
})

// ---------------------------------------------------------------------------
// Non-Axios / network errors
// ---------------------------------------------------------------------------

describe('parseApiError — non-Axios errors', () => {
    it('returns status 0 and error.message for a regular Error', () => {
        const result = parseApiError(new Error('connection reset'))
        expect(result.status).toBe(0)
        expect(result.message).toBe('connection reset')
    })

    it('returns status 0 and String() representation for a plain string', () => {
        const result = parseApiError('timeout occurred')
        expect(result.status).toBe(0)
        expect(result.message).toBe('timeout occurred')
    })

    it('handles null gracefully (status 0, message "null")', () => {
        const result = parseApiError(null)
        expect(result.status).toBe(0)
        expect(result.message).toBe('null')
    })

    it('handles undefined gracefully (status 0, message "undefined")', () => {
        const result = parseApiError(undefined)
        expect(result.status).toBe(0)
        expect(result.message).toBe('undefined')
    })

    it('handles numeric error values', () => {
        const result = parseApiError(42)
        expect(result.status).toBe(0)
        expect(result.message).toBe('42')
    })

    it('isAxiosError without a response is treated as a non-Axios error', () => {
        // Axios network errors have isAxiosError = true but no .response
        const networkErr = Object.assign(new Error('Network Error'), {
            isAxiosError: true,
            response: undefined,
        })
        const result = parseApiError(networkErr)
        expect(result.status).toBe(0)
        expect(result.message).toBe('Network Error')
    })
})
