import type { ComputedRef } from "vue";
import type { DevtoolsInstance, RequestRecord } from "../types/index";
import { instances, requests, getRequestsByInstance } from "../store/devtoolsStore";

export interface UseDevtoolsStoreReturn {
    /**
     * All currently registered useApi composable instances, keyed by ID.
     * Read-only map is updated reactively as instances are created/destroyed.
     */
    instances: ComputedRef<ReadonlyMap<string, DevtoolsInstance>>;

    /**
     * All recorded HTTP request records in chronological order.
     * Circular buffer with a max size configured during devtools initialization.
     */
    requests: ComputedRef<ReadonlyArray<RequestRecord>>;

    /**
     * Retrieve all requests issued by a specific instance.
     */
    getRequestsByInstance: typeof getRequestsByInstance;
}

/**
 * Composable that exposes the devtools reactive store for use in panel components.
 *
 * Provides access to tracked useApi instances, their state, and all recorded requests.
 * The returned refs are ComputedRef, so they remain reactive as the store is mutated
 * by instrumentation hooks.
 *
 * @example
 * ```ts
 * export default defineComponent({
 *   setup() {
 *     const { instances, requests, getRequestsByInstance } = useDevtoolsStore();
 *     return { instances, requests, getRequestsByInstance };
 *   },
 * });
 * ```
 */
export function useDevtoolsStore(): UseDevtoolsStoreReturn {
    return {
        instances,
        requests,
        getRequestsByInstance,
    };
}
