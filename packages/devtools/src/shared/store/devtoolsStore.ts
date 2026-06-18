import { reactive, computed, type ComputedRef } from "vue";
import type {
    DevtoolsInstance,
    DevtoolsInstanceOptions,
    DevtoolsInstanceState,
    DevtoolsOptions,
    RequestRecord,
    RequestEndResult,
} from "../types/index";

interface StoreState {
    instances: Map<string, DevtoolsInstance>;
    requests: RequestRecord[];
    config: { maxHistory: number; maxPayloadSize: number };
}

const state = reactive<StoreState>({
    instances: new Map(),
    requests: [],
    config: { maxHistory: 300, maxPayloadSize: 200_000 },
});

function truncateValue(value: unknown, maxBytes: number): { value: unknown; truncated: boolean } {
    try {
        const serialized = JSON.stringify(value);
        if (!serialized || serialized.length <= maxBytes) return { value, truncated: false };
        return {
            value: serialized.slice(0, maxBytes) + `\n…[+${serialized.length - maxBytes} bytes truncated]`,
            truncated: true,
        };
    } catch {
        return { value: "[non-serializable]", truncated: true };
    }
}

export const instances: ComputedRef<ReadonlyMap<string, DevtoolsInstance>> = computed(
    () => state.instances as ReadonlyMap<string, DevtoolsInstance>,
);

export const requests: ComputedRef<ReadonlyArray<RequestRecord>> = computed(
    () => state.requests as ReadonlyArray<RequestRecord>,
);

/**
 * Initialize (or reset) the store with new configuration.
 * Clears all instances and request history.
 */
export function initDevtoolsStore(config: Pick<DevtoolsOptions, "maxHistory" | "maxPayloadSize">): void {
    state.instances.clear();
    state.requests.splice(0);
    state.config.maxHistory = config.maxHistory ?? 300;
    state.config.maxPayloadSize = config.maxPayloadSize ?? 200_000;
}

/**
 * Register a new useApi composable instance.
 * Called when a useApi composable is created.
 */
export function registerInstance(
    id: string,
    url: string | undefined,
    options: DevtoolsInstanceOptions,
): void {
    state.instances.set(id, {
        id,
        url,
        method: "GET",
        createdAt: Date.now(),
        state: { loading: false, error: null, statusCode: null, data: null },
        options,
        requestCount: 0,
        lastRequestAt: null,
    });
}

/**
 * Remove a useApi composable instance from the store.
 * Called when a useApi composable is destroyed.
 */
export function unregisterInstance(id: string): void {
    state.instances.delete(id);
}

/**
 * Merge a partial state update into an existing instance.
 * Silently ignores unknown instance ids.
 */
export function updateInstanceState(id: string, partial: Partial<DevtoolsInstanceState>): void {
    const instance = state.instances.get(id);
    if (!instance) return;
    instance.state = { ...instance.state, ...partial };
}

/**
 * Add a new request record to the circular buffer.
 * Evicts the oldest record when maxHistory is reached.
 * Payload and queryParams are truncated if they exceed maxPayloadSize.
 */
export function addRequest(
    partial: Omit<RequestRecord, "duration" | "response" | "error" | "truncated" | "instanceOptions">,
): void {
    const { value: truncatedPayload, truncated: payloadTruncated } = truncateValue(partial.payload, state.config.maxPayloadSize);
    const { value: truncatedQueryParams, truncated: queryParamsTruncated } = truncateValue(partial.queryParams, state.config.maxPayloadSize);
    const record: RequestRecord = {
        ...partial,
        payload: truncatedPayload,
        queryParams: truncatedQueryParams,
        duration: null,
        response: null,
        error: null,
        truncated: payloadTruncated || queryParamsTruncated,
        instanceOptions: partial.instanceId
            ? state.instances.get(partial.instanceId)?.options
            : undefined,
    };
    if (state.requests.length >= state.config.maxHistory) {
        state.requests.shift();
    }
    state.requests.push(record);

    if (partial.instanceId) {
        const instance = state.instances.get(partial.instanceId);
        if (instance) {
            instance.requestCount++;
            instance.lastRequestAt = partial.startedAt;
        }
    }
}

/**
 * Update a completed request with its result (success, error, or aborted).
 * Silently ignores unknown request ids.
 */
export function updateRequest(id: string, result: RequestEndResult): void {
    const idx = state.requests.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const record = state.requests[idx];

    if (result.status === "success") {
        const { value: truncatedResponse, truncated } = truncateValue(
            result.response,
            state.config.maxPayloadSize,
        );
        state.requests[idx] = {
            ...record,
            status: "success",
            statusCode: result.statusCode,
            response: truncatedResponse,
            duration: result.duration,
            truncated: record.truncated || truncated,
        };
    } else if (result.status === "error") {
        const { value: truncatedBody, truncated } = truncateValue(
            result.error.details ?? null,
            state.config.maxPayloadSize,
        );
        state.requests[idx] = {
            ...record,
            status: "error",
            statusCode: result.statusCode,
            error: result.error,
            response: truncatedBody,
            duration: result.duration,
            truncated: record.truncated || truncated,
        };
    } else {
        state.requests[idx] = { ...record, status: "aborted", duration: result.duration };
    }
}

/**
 * Remove all request records from the store.
 */
export function clearRequests(): void {
    state.requests.splice(0);
}

/**
 * Return all request records for a given instance id.
 */
export function getRequestsByInstance(instanceId: string): ReadonlyArray<RequestRecord> {
    return state.requests.filter((r) => r.instanceId === instanceId);
}
