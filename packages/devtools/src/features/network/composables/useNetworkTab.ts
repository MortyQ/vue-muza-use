import { useNetworkFilter, type UseNetworkFilterReturn } from "./useNetworkFilter";
import { useRequestDetail, type UseRequestDetailReturn } from "./useRequestDetail";
import { instances } from "../../../shared/store/devtoolsStore";

/**
 * Composable for the Network tab — combines filtering, request detail, and instance list.
 *
 * @example
 * ```ts
 * const { urlFilter, filteredRequests, selectedRequest, instances } = useNetworkTab();
 * ```
 */
export function useNetworkTab(): UseNetworkFilterReturn & UseRequestDetailReturn & { instances: typeof instances } {
    const filter = useNetworkFilter();
    const detail = useRequestDetail();
    return { ...filter, ...detail, instances };
}
