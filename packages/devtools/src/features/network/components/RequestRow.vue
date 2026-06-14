<script setup lang="ts">
import type { RequestRecord } from "../../../shared/types/index";
import StatusBadge from "./StatusBadge.vue";
defineProps<{ request: RequestRecord; isActive: boolean }>();
defineEmits<{ (e: "select", id: string): void }>();

function formatDuration(ms: number | null): string {
    if (ms === null) return "…";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
}
</script>

<template>
    <div
        data-vmd-request-row
        :class="['vmd:flex vmd:items-center vmd:gap-2 vmd:px-3 vmd:py-1.5 vmd:text-xs vmd:cursor-pointer vmd:border-b vmd:border-neutral-800',
                 isActive ? 'vmd:bg-neutral-800' : 'vmd:hover:bg-neutral-850']"
        @click="$emit('select', request.id)"
    >
        <span class="vmd:w-12 vmd:text-neutral-400 vmd:uppercase vmd:font-mono">{{ request.method }}</span>
        <span class="vmd:flex-1 vmd:truncate vmd:text-neutral-200">{{ request.url }}</span>
        <StatusBadge :status="request.status" :status-code="request.statusCode" />
        <span class="vmd:w-14 vmd:text-right vmd:text-neutral-500">{{ formatDuration(request.duration) }}</span>
        <span class="vmd:w-16 vmd:text-right vmd:text-neutral-600">{{ formatTime(request.startedAt) }}</span>
    </div>
</template>
