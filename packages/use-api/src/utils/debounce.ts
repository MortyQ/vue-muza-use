export class DebounceCancelledError extends Error {
    readonly isDebounceCancelled = true;

    constructor() {
        super('Debounced call was superseded by a newer call');
        this.name = 'DebounceCancelledError';
    }
}

/**
 * Debounce an async function.
 *
 * When a new call arrives before the delay has elapsed:
 *   - The previous pending Promise is REJECTED with DebounceCancelledError.
 *   - Only the last call within the delay window actually executes.
 *
 * Callers can detect superseded calls via `err instanceof DebounceCancelledError`.
 * useApi silently swallows DebounceCancelledError internally so consumers
 * never need to handle it when using the `execute()` composable method.
 */
export function debounceFn<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    delay: number
): (...args: A) => Promise<R> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingReject: ((reason: unknown) => void) | null = null;

    return function (...args: A) {
        // Reject the previous superseded promise immediately.
        if (pendingReject) {
            pendingReject(new DebounceCancelledError());
            pendingReject = null;
        }

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise<R>((resolve, reject) => {
            pendingReject = reject;

            timeoutId = setTimeout(async () => {
                pendingReject = null;
                timeoutId = null;
                try {
                    resolve(await fn(...args));
                } catch (err) {
                    reject(err);
                }
            }, delay);
        });
    };
}
