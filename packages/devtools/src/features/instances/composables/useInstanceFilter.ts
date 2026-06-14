import { ref, computed, type Ref, type ComputedRef } from "vue";
import { instances } from "../../../shared/store/devtoolsStore";
import type { DevtoolsInstance } from "../../../shared/types/index";

/**
 * Return type for {@link useInstanceFilter}.
 */
export interface UseInstanceFilterReturn {
    searchTerm: Ref<string>;
    filteredInstances: ComputedRef<DevtoolsInstance[]>;
}

/**
 * Composable for filtering the devtools instance list by URL substring.
 *
 * @example
 * ```ts
 * const { searchTerm, filteredInstances } = useInstanceFilter();
 * searchTerm.value = "users";
 * // filteredInstances.value now contains only instances whose URL contains "users"
 * ```
 */
export function useInstanceFilter(): UseInstanceFilterReturn {
    const searchTerm = ref("");

    const filteredInstances = computed((): DevtoolsInstance[] => {
        const list = [...instances.value.values()];
        if (!searchTerm.value) return list;
        const term = searchTerm.value.toLowerCase();
        return list.filter((i) => i.url?.toLowerCase().includes(term));
    });

    return { searchTerm, filteredInstances };
}
