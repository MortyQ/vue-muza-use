import { useInstanceFilter } from "./useInstanceFilter";
import { useInstanceDetail } from "./useInstanceDetail";

/**
 * Top-level composable for the Instances tab, combining filter and detail concerns.
 *
 * @example
 * ```ts
 * const { searchTerm, filteredInstances, selectedInstance, selectInstance, clearSelection } = useInstancesTab();
 * ```
 */
export function useInstancesTab() {
    const { searchTerm, filteredInstances } = useInstanceFilter();
    const { selectedInstance, instanceRequests, selectInstance, clearSelection } = useInstanceDetail();
    return { searchTerm, filteredInstances, selectedInstance, instanceRequests, selectInstance, clearSelection };
}
