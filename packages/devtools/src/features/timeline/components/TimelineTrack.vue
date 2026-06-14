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
    <div class="vmd:flex vmd:items-center vmd:border-b vmd:border-neutral-800 vmd:py-1">
        <div class="vmd:w-40 vmd:shrink-0 vmd:pr-2 vmd:text-xs vmd:text-neutral-400 vmd:truncate">
            {{ instance.url ?? instance.id }}
        </div>
        <div class="vmd:flex-1 vmd:relative vmd:h-6 vmd:bg-neutral-800 vmd:rounded vmd:overflow-hidden">
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
