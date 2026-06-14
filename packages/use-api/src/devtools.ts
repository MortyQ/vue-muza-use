import type { App } from "vue";
import type {
    DevtoolsBridge,
    DevtoolsOptions,
    DevtoolsInstanceOptions,
    DevtoolsInstanceState,
    DevtoolsRequestRecord,
    RequestEndResult,
} from "./types";

let bridge: DevtoolsBridge | null = null;
let requestCounter = 0;
const pendingCalls: Array<() => void> = [];

/**
 * Increments and returns a unique request ID for devtools tracking.
 * Called inside executeRequest() — not in setup context.
 */
export function nextRequestId(): string {
    return `req_${++requestCounter}`;
}

/**
 * Dynamically loads `@ametie/vue-muza-devtools` and initialises the bridge.
 * No-op when `options.enabled` is false. Called once from plugin install hook.
 *
 * @example
 * ```ts
 * // In plugin install hook:
 * await initDevtools({ enabled: true }, app);
 * ```
 */
export async function initDevtools(options: DevtoolsOptions, app: App): Promise<void> {
    if (!options.enabled) return;
    try {
        const { createBridge } = await import("@ametie/vue-muza-devtools");
        bridge = createBridge(options, app);
        for (const fn of pendingCalls) fn();
        pendingCalls.length = 0;
    } catch {
        console.warn("[vue-muza-use] devtools enabled but @ametie/vue-muza-devtools is not installed");
    }
}

/**
 * Thin proxy over the bridge. All methods are safe no-ops when the bridge is null
 * (devtools disabled or not yet loaded). Zero overhead in production.
 *
 * @example
 * ```ts
 * devtoolsBridge.onInstanceCreated(id, url, options);
 * devtoolsBridge.onRequestStart(record);
 * devtoolsBridge.onRequestEnd(requestId, { status: "success", duration: 42 });
 * ```
 */
export const devtoolsBridge = {
    onInstanceCreated(id: string, url: string | undefined, options: DevtoolsInstanceOptions): void {
        if (bridge) {
            bridge.onInstanceCreated(id, url, options);
        } else {
            pendingCalls.push(() => bridge?.onInstanceCreated(id, url, options));
        }
    },
    onInstanceDestroyed(id: string): void {
        bridge?.onInstanceDestroyed(id);
    },
    onStateUpdate(id: string, state: Partial<DevtoolsInstanceState>): void {
        bridge?.onStateUpdate(id, state);
    },
    onRequestStart(record: DevtoolsRequestRecord): void {
        bridge?.onRequestStart(record);
    },
    onRequestEnd(id: string, result: RequestEndResult): void {
        bridge?.onRequestEnd(id, result);
    },
} satisfies DevtoolsBridge;
