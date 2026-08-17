import { getCurrentScope, onScopeDispose, toValue, watch, type Ref } from "vue";

import type { UseApiOptions } from "../types";

/** The `poll` option shape, as declared on {@link UseApiOptions}. */
type PollOption = NonNullable<UseApiOptions["poll"]>;

/** Resolved polling configuration for the current tick. */
interface PollConfig {
    interval: number;
    whenHidden: boolean;
}

export interface UsePollingReturn {
    /** Cancel a scheduled tick, if any. Safe to call when nothing is scheduled. */
    stop: () => void;
    /**
     * Schedule the next tick. Call after a request settles (success or final failure).
     * No-ops when the interval is 0 or the tab is hidden and `whenHidden` is false.
     */
    scheduleNext: () => void;
}

/**
 * Internal composable owning the polling timer: interval resolution, tab-visibility
 * handling, catch-up on refocus, and restart when the `poll` option changes.
 *
 * The two callbacks are deliberately distinct. `run` is a direct execution used for
 * a tick and for the visibility catch-up. `runCoalesced` is used when the `poll`
 * option itself changes, so that a config change arriving in the same flush as other
 * dep changes collapses into a single request.
 *
 * @example
 * ```ts
 * const polling = usePolling(poll, {
 *     loading: state.loading,
 *     run: () => execute(),
 *     runCoalesced: scheduleAutoTrigger,
 * });
 * ```
 */
export function usePolling(
    poll: PollOption,
    handlers: {
        loading: Ref<boolean>;
        run: () => void;
        runCoalesced: () => void;
    },
): UsePollingReturn {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const getConfig = (): PollConfig => {
        const val = toValue(poll);
        if (typeof val === "number") return { interval: val, whenHidden: false };
        if (val && typeof val === "object") {
            return {
                interval: toValue(val.interval),
                whenHidden: toValue(val.whenHidden) ?? false,
            };
        }
        return { interval: 0, whenHidden: false };
    };

    /** Tab is visible, or polling is allowed while hidden. In SSR there is no document. */
    const visibilityAllows = (whenHidden: boolean): boolean =>
        whenHidden || typeof document === "undefined" || !document.hidden;

    const stop = (): void => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const scheduleNext = (): void => {
        const { interval, whenHidden } = getConfig();
        if (interval <= 0) return;
        // typeof document check kept separate from visibilityAllows: scheduling in SSR
        // is pointless, whereas the tick itself tolerates a missing document.
        if (!whenHidden && (typeof document === "undefined" || document.hidden)) return;
        timer = setTimeout(() => {
            timer = null;
            if (visibilityAllows(getConfig().whenHidden)) handlers.run();
        }, interval);
    };

    // Visibility handling — only when polling is configured at setup time.
    // `poll` may be a ref/getter (always truthy) — that's fine: the handler
    // re-reads the config and no-ops when the interval is 0.
    if (poll && typeof document !== "undefined") {
        const handleVisibility = (): void => {
            if (document.hidden) return;
            // On tab focus, if polling is enabled and no timer is running, resume/catch-up
            if (getConfig().interval > 0 && !timer && !handlers.loading.value) {
                handlers.run();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        if (getCurrentScope()) {
            onScopeDispose(() => document.removeEventListener("visibilitychange", handleVisibility));
        }
    }

    // Restart on a dynamic `poll` change so a new interval applies immediately.
    if (poll) {
        watch(
            () => toValue(poll),
            () => {
                const { interval } = getConfig();
                stop();
                // Idle → send now to apply the new settings. Mid-request, the pending
                // request's own scheduleNext() picks the new interval up.
                if (interval > 0 && !handlers.loading.value) handlers.runCoalesced();
            },
            { deep: true },
        );
    }

    return { stop, scheduleNext };
}
