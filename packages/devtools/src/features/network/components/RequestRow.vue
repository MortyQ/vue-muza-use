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
        :class="['flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b border-neutral-800',
                 isActive ? 'bg-neutral-800' : 'hover:bg-neutral-850']"
        @click="$emit('select', request.id)"
    >
        <span class="w-12 text-neutral-400 uppercase font-mono">{{ request.method }}</span>
        <span class="flex-1 truncate text-neutral-200">{{ request.url }}</span>
        <StatusBadge :status="request.status" :status-code="request.statusCode" />
        <span class="w-14 text-right text-neutral-500">{{ formatDuration(request.duration) }}</span>
        <span class="w-16 text-right text-neutral-600">{{ formatTime(request.startedAt) }}</span>
    </div>
</template>
