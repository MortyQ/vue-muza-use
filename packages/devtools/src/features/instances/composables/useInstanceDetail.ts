import { ref, computed } from "vue";
import { instances, getRequestsByInstance } from "../../../shared/store/devtoolsStore";

/**
 * Composable for managing the selected instance in the detail panel.
 *
 * @example
 * ```ts
 * const { selectedInstance, selectInstance, clearSelection } = useInstanceDetail();
 * selectInstance("instance-id");
 * // selectedInstance.value is now populated
 * ```
 */
export function useInstanceDetail() {
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
