import type { ComputedRef } from "vue";
import type { DevtoolsTab } from "../types/index";
import { registeredTabs } from "../plugins/tabRegistry";

export interface UseTabRegistryReturn {
    /**
     * All currently registered devtools tabs, sorted by order ascending.
     * Read-only array is updated reactively as tabs are registered/unregistered.
     */
    registeredTabs: ComputedRef<ReadonlyArray<DevtoolsTab & { order: number }>>;
}

/**
 * Composable that exposes the sorted registered tabs list for use in panel components.
 *
 * Provides access to all custom tabs registered in the devtools panel.
 * The returned ref is a ComputedRef, so it remains reactive as tabs are added or removed.
 *
 * @example
 * ```ts
 * export default defineComponent({
 *   setup() {
 *     const { registeredTabs } = useTabRegistry();
 *     return { registeredTabs };
 *   },
 * });
 * ```
 */
export function useTabRegistry(): UseTabRegistryReturn {
    return {
        registeredTabs,
    };
}
