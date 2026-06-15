import { ref, computed, type Ref, type ComputedRef } from "vue";
import { requests } from "../../../shared/store/devtoolsStore";
import type { RequestStatus, RequestRecord } from "../../../shared/types/index";

export interface UseNetworkFilterReturn {
    urlFilter: Ref<string>;
    statusFilter: Ref<RequestStatus | "all">;
    instanceFilter: Ref<string | "all">;
    filteredRequests: ComputedRef<ReadonlyArray<RequestRecord>>;
    clearFilters: () => void;
}

/**
 * Composable for filtering the network request list by URL, status, and instance.
 *
 * @example
 * ```ts
 * const { urlFilter, filteredRequests, clearFilters } = useNetworkFilter();
 * ```
 */
export function useNetworkFilter(): UseNetworkFilterReturn {
    const urlFilter = ref("");
    const statusFilter = ref<RequestStatus | "all">("all");
    const instanceFilter = ref<string | "all">("all");

    const filteredRequests = computed((): ReadonlyArray<RequestRecord> => {
        return requests.value.filter((r) => {
            if (urlFilter.value && !r.url.toLowerCase().includes(urlFilter.value.toLowerCase())) return false;
            if (statusFilter.value !== "all" && r.status !== statusFilter.value) return false;
            if (instanceFilter.value !== "all" && r.instanceId !== instanceFilter.value) return false;
            return true;
        }).reverse();
    });

    function clearFilters(): void {
        urlFilter.value = "";
        statusFilter.value = "all";
        instanceFilter.value = "all";
    }

    return { urlFilter, statusFilter, instanceFilter, filteredRequests, clearFilters };
}
