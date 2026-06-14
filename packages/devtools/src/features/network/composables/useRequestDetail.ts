import { ref, computed, type Ref, type ComputedRef } from "vue";
import { requests } from "../../../shared/store/devtoolsStore";
import type { RequestRecord } from "../../../shared/types/index";

type ViewMode = "split" | "payload" | "response" | "headers";
type Format = "json" | "kv";

export interface UseRequestDetailReturn {
    selectedRequest: ComputedRef<RequestRecord | null>;
    selectedRequestId: Ref<string | null>;
    viewMode: Ref<ViewMode>;
    payloadFormat: Ref<Format>;
    responseFormat: Ref<Format>;
    selectRequest: (id: string | null) => void;
    setViewMode: (mode: ViewMode) => void;
    togglePayloadFormat: () => void;
    toggleResponseFormat: () => void;
}

/**
 * Composable for managing the selected network request and its detail view state.
 *
 * @example
 * ```ts
 * const { selectedRequest, selectRequest, setViewMode } = useRequestDetail();
 * ```
 */
export function useRequestDetail(): UseRequestDetailReturn {
    const selectedRequestId = ref<string | null>(null);
    const viewMode = ref<ViewMode>("split");
    const payloadFormat = ref<Format>("json");
    const responseFormat = ref<Format>("json");

    const selectedRequest = computed((): RequestRecord | null =>
        selectedRequestId.value
            ? (requests.value.find((r) => r.id === selectedRequestId.value) ?? null)
            : null,
    );

    function selectRequest(id: string | null): void { selectedRequestId.value = id; }
    function setViewMode(mode: ViewMode): void { viewMode.value = mode; }
    function togglePayloadFormat(): void { payloadFormat.value = payloadFormat.value === "json" ? "kv" : "json"; }
    function toggleResponseFormat(): void { responseFormat.value = responseFormat.value === "json" ? "kv" : "json"; }

    return {
        selectedRequest, selectedRequestId,
        viewMode, payloadFormat, responseFormat,
        selectRequest, setViewMode, togglePayloadFormat, toggleResponseFormat,
    };
}
