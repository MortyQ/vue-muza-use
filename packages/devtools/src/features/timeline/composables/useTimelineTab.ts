import { computed, type ComputedRef } from "vue";
import { instances, requests, getRequestsByInstance } from "../../../shared/store/devtoolsStore";
import { useTimelineFilter, type UseTimelineFilterReturn } from "./useTimelineFilter";
import type { DevtoolsInstance, RequestRecord } from "../../../shared/types/index";

interface InstanceTimeline {
    instance: DevtoolsInstance;
    requests: ReadonlyArray<RequestRecord>;
}

interface TimeRange {
    start: number;
    end: number;
    duration: number;
}

export interface UseTimelineTabReturn extends UseTimelineFilterReturn {
    instanceTimelines: ComputedRef<InstanceTimeline[]>;
    timeRange: ComputedRef<TimeRange>;
}

/**
 * Composable for the Timeline tab — per-instance request tracks with zoom and status filter.
 *
 * @example
 * ```ts
 * const { instanceTimelines, timeRange, zoom, zoomIn } = useTimelineTab();
 * ```
 */
export function useTimelineTab(): UseTimelineTabReturn {
    const { statusFilter, zoom, zoomIn, zoomOut } = useTimelineFilter();

    const instanceTimelines = computed((): InstanceTimeline[] =>
        [...instances.value.values()].map((instance) => ({
            instance,
            requests: getRequestsByInstance(instance.id).filter(
                (r) => statusFilter.value === "all" || r.status === statusFilter.value,
            ),
        })),
    );

    const timeRange = computed((): TimeRange => {
        if (requests.value.length === 0) {
            const now = Date.now();
            return { start: now - 60_000, end: now, duration: 60_000 };
        }
        const start = Math.min(...requests.value.map((r) => r.startedAt));
        const end = Math.max(...requests.value.map((r) => r.startedAt + (r.duration ?? 0)));
        return { start, end, duration: Math.max(end - start, 1) };
    });

    return { instanceTimelines, timeRange, statusFilter, zoom, zoomIn, zoomOut };
}
