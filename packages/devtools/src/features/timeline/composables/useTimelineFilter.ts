import { ref, type Ref } from "vue";
import type { RequestStatus } from "../../../shared/types/index";

export interface UseTimelineFilterReturn {
    statusFilter: Ref<RequestStatus | "all">;
    zoom: Ref<number>;
    zoomIn: () => void;
    zoomOut: () => void;
}

/**
 * Composable for timeline status filter and zoom level.
 *
 * @example
 * ```ts
 * const { zoom, zoomIn, zoomOut } = useTimelineFilter();
 * ```
 */
export function useTimelineFilter(): UseTimelineFilterReturn {
    const statusFilter = ref<RequestStatus | "all">("all");
    const zoom = ref(1);

    function zoomIn(): void { zoom.value = Math.min(zoom.value * 1.5, 10); }
    function zoomOut(): void { zoom.value = Math.max(zoom.value / 1.5, 0.1); }

    return { statusFilter, zoom, zoomIn, zoomOut };
}
