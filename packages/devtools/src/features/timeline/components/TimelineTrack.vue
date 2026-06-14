<script setup lang="ts">
import type { DevtoolsInstance, RequestRecord } from "../../../shared/types/index";
import TimelineEvent from "./TimelineEvent.vue";

defineProps<{
    instance: DevtoolsInstance;
    requests: ReadonlyArray<RequestRecord>;
    timeRange: { start: number; end: number; duration: number };
    zoom: number;
}>();
</script>

<template>
    <div class="flex items-center border-b border-neutral-800 py-1">
        <div class="w-40 shrink-0 pr-2 text-xs text-neutral-400 truncate">
            {{ instance.url ?? instance.id }}
        </div>
        <div class="flex-1 relative h-6 bg-neutral-800 rounded overflow-hidden">
            <TimelineEvent
                v-for="req in requests"
                :key="req.id"
                :request="req"
                :time-range="timeRange"
                :zoom="zoom"
            />
        </div>
    </div>
</template>
