import { ref, computed } from "vue";
import { instances } from "../../../shared/store/devtoolsStore";
import type { DevtoolsInstance } from "../../../shared/types/index";

/**
 * Composable for filtering the list of registered useApi instances.
 *
 * @example
 * ```ts
 * const { searchTerm, filteredInstances } = useInstanceFilter();
 * searchTerm.value = "users";
 * // filteredInstances.value now contains only instances whose URL contains "users"
 * ```
 */
export function useInstanceFilter() {
    const searchTerm = ref("");

    const filteredInstances = computed((): DevtoolsInstance[] => {
        const list = [...instances.value.values()];
        if (!searchTerm.value) return list;
        const term = searchTerm.value.toLowerCase();
        return list.filter((i) => i.url?.toLowerCase().includes(term));
    });

    return { searchTerm, filteredInstances };
}
