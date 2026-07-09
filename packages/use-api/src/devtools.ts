import type { App } from "vue";
import { createBridge as _createBridge } from "@ametie/vue-muza-devtools";
import type {
    DevtoolsBridge,
    DevtoolsOptions,
    DevtoolsInstanceOptions,
    DevtoolsInstanceState,
    DevtoolsRequestRecord,
    RequestEndResult,
} from "./types";

const TOKEN_KEY_RE = /token|jwt|bearer|secret|password|authoriz(e|ation)|api[_-]?key|session/i;

let bridge: DevtoolsBridge | null = null;
let devtoolsExpected = false;
let requestCounter = 0;
// Keyed by instance id so a destroy can remove its own queued "created" event.
// Only onInstanceCreated ever queues — all other bridge methods are no-ops until load.
const pendingInstances = new Map<string, () => void>();

/**
 * Increments and returns a unique request ID for devtools tracking.
 * Called inside executeRequest() — not in setup context.
 */
export function nextRequestId(): string {
    return `req_${++requestCounter}`;
}

/**
 * Marks whether a devtools bridge is ever going to load for this app.
 * Called synchronously from createApi() — before any useApi() instance exists —
 * so instrumentation can skip all queueing/watching when devtools is off.
 */
export function setDevtoolsExpected(expected: boolean): void {
    devtoolsExpected = expected;
}

/** Whether devtools was configured for this app (bridge loaded or loading). */
export function isDevtoolsExpected(): boolean {
    return devtoolsExpected;
}

/** @internal Test-only accessors — not exported from index.ts. */
export function __devtoolsInternals(): {
    pendingCount: () => number;
    setExpected: (v: boolean) => void;
    reset: () => void;
} {
    return {
        pendingCount: () => pendingInstances.size,
        setExpected: (v: boolean) => { devtoolsExpected = v; },
        reset: () => {
            bridge = null;
            devtoolsExpected = false;
            pendingInstances.clear();
        },
    };
}

/**
 * Recursively redact credential-bearing fields (token/jwt/bearer/secret/password/
 * authorization/apiKey/session, case-insensitive) before a record is handed to
 * devtools. Applied to auth-refresh payloads/responses/error details so tokens
 * never enter the devtools history buffer — including when nested (e.g. a
 * consumer's `extractTokens` response shape wraps tokens under a sub-object).
 * Non-plain-object leaves (primitives, dates, etc.) are returned unchanged;
 * arrays are walked element-wise.
 */
export function redactTokenFields(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redactTokenFields);
    if (value === null || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
        out[key] = TOKEN_KEY_RE.test(key) ? "•••redacted•••" : redactTokenFields(v);
    }
    return out;
}

/**
 * Initialises the devtools bridge. No-op when `options.enabled` is false.
 * Called once from plugin install hook.
 *
 * @example
 * ```ts
 * // In plugin install hook:
 * await initDevtools({ enabled: true }, app);
 * ```
 */
export async function initDevtools(options: DevtoolsOptions, app: App): Promise<void> {
    if (!options.enabled) return;
    devtoolsExpected = true;
    try {
        bridge = _createBridge(options, app);
    } catch {
        // Bridge failed to load — degrade to the same no-op behavior as
        // "devtools never configured" instead of queueing forever.
        devtoolsExpected = false;
        pendingInstances.clear();
        return;
    }
    for (const fn of pendingInstances.values()) fn();
    pendingInstances.clear();
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
        } else if (devtoolsExpected) {
            pendingInstances.set(id, () => bridge?.onInstanceCreated(id, url, options));
        }
    },
    onInstanceDestroyed(id: string): void {
        pendingInstances.delete(id);
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
    onRequestAuthRetry(id: string): void {
        // Double optional chain: bridge may be null (devtools off), and an older
        // @ametie/vue-muza-devtools may not implement this method yet.
        bridge?.onRequestAuthRetry?.(id);
    },
} satisfies DevtoolsBridge;
