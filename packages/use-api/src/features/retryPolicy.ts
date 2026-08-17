/**
 * Retry policy — how many attempts a failed request gets, and which failures qualify.
 * Kept out of useApi.ts so the retry rules live in one place instead of being
 * spread between the option defaults and the request's catch block.
 */

/** Status codes retried by default: timeouts, rate limits and transient 5xx. */
export const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/** Attempts granted by `retry: true`. */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Resolve the `retry` option into a concrete attempt count.
 * `false` → 0, `true` → {@link DEFAULT_MAX_RETRIES}, a number passes through.
 */
export function resolveMaxRetries(retry: boolean | number): number {
    if (retry === false) return 0;
    if (retry === true) return DEFAULT_MAX_RETRIES;
    return retry;
}

/**
 * Whether a failed attempt should be retried: attempts must be left, and the
 * error's status must be in `statusCodes`. An empty `statusCodes` list means
 * "retry regardless of status".
 */
export function shouldRetry(
    attemptsMade: number,
    maxRetries: number,
    statusCodes: readonly number[],
    status: number,
): boolean {
    if (attemptsMade >= maxRetries) return false;
    return statusCodes.length === 0 || statusCodes.includes(status);
}
