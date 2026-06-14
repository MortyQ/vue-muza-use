import { ref, computed, type ComputedRef } from "vue";
import { instances, getRequestsByInstance } from "../../../shared/store/devtoolsStore";
import type { DevtoolsInstance, RequestRecord } from "../../../shared/types/index";

/**
 * Return type for {@link useInstanceDetail}.
 */
export interface UseInstanceDetailReturn {
    selectedInstance: ComputedRef<DevtoolsInstance | null>;
    instanceRequests: ComputedRef<ReadonlyArray<RequestRecord>>;
    selectInstance: (id: string) => void;
    clearSelection: () => void;
}

/**
 * Composable for tracking the selected instance in the Instances tab.
 *
 * @example
 * ```ts
 * const { selectedInstance, selectInstance } = useInstanceDetail();
 * selectInstance("my-id");
 * ```
 */
export function useInstanceDetail(): UseInstanceDetailReturn {
    const selectedInstanceId = ref<string | null>(null);

    const selectedInstance = computed(() =>
        selectedInstanceId.value ? (instances.value.get(selectedInstanceId.value) ?? null) : null,
    );

    const instanceRequests = computed(() =>
        selectedInstanceId.value ? getRequestsByInstance(selectedInstanceId.value) : [],
    );

    function selectInstance(id: string): void { selectedInstanceId.value = id; }
    function clearSelection(): void { selectedInstanceId.value = null; }

    return { selectedInstance, instanceRequests, selectInstance, clearSelection };
}
