<script setup lang="ts">
import type { RequestRecord } from "../../../shared/types/index";

const props = defineProps<{ request: RequestRecord; timeRange: { start: number; duration: number }; zoom: number }>();

const statusColor: Record<string, string> = {
    success: "vmd:bg-green-500",
    error:   "vmd:bg-red-500",
    pending: "vmd:bg-yellow-500",
    aborted: "vmd:bg-neutral-500",
};

function left(): string {
    const offset = ((props.request.startedAt - props.timeRange.start) / props.timeRange.duration) * 100;
    return `${offset * props.zoom}%`;
}
function width(): string {
    const dur = props.request.duration ?? 10;
    const pct = (dur / props.timeRange.duration) * 100;
    return `${Math.max(pct * props.zoom, 0.2)}%`;
}
</script>

<template>
    <div
        :title="`${request.method} ${request.url} (${request.duration ?? '…'}ms)`"
        :class="['vmd:absolute vmd:h-4 vmd:rounded-sm vmd:opacity-80 vmd:hover:opacity-100 vmd:cursor-pointer', statusColor[request.status]]"
        :style="{ left: left(), width: width() }"
    />
</template>
