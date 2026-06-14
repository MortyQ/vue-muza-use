import { useInstanceFilter, type UseInstanceFilterReturn } from "./useInstanceFilter";
import { useInstanceDetail, type UseInstanceDetailReturn } from "./useInstanceDetail";

/**
 * Return type for {@link useInstancesTab}.
 */
export type UseInstancesTabReturn = UseInstanceFilterReturn & UseInstanceDetailReturn;

/**
 * Composable for the Instances tab — combines filtering and instance detail selection.
 *
 * @example
 * ```ts
 * const { searchTerm, filteredInstances, selectedInstance, selectInstance } = useInstancesTab();
 * ```
 */
export function useInstancesTab(): UseInstancesTabReturn {
    const { searchTerm, filteredInstances } = useInstanceFilter();
    const { selectedInstance, instanceRequests, selectInstance, clearSelection } = useInstanceDetail();
    return { searchTerm, filteredInstances, selectedInstance, instanceRequests, selectInstance, clearSelection };
}
