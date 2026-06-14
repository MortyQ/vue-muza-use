<script setup lang="ts">
import { useTimelineTab } from "../composables/useTimelineTab";
import TimelineTrack from "./TimelineTrack.vue";

const { instanceTimelines, timeRange, statusFilter, zoom, zoomIn, zoomOut } = useTimelineTab();
</script>

<template>
    <div class="vmd:flex vmd:flex-col vmd:h-full">
        <div class="vmd:flex vmd:items-center vmd:gap-3 vmd:px-3 vmd:py-2 vmd:border-b vmd:border-neutral-700">
            <select v-model="statusFilter" class="vmd:bg-neutral-800 vmd:text-xs vmd:text-white vmd:px-2 vmd:py-1 vmd:rounded">
                <option value="all">All</option>
                <option v-for="s in ['pending','success','error','aborted']" :key="s" :value="s">{{ s }}</option>
            </select>
            <div class="vmd:flex vmd:gap-1 vmd:ml-auto">
                <button class="vmd:text-xs vmd:text-neutral-400 vmd:hover:text-white vmd:px-2" @click="zoomOut">−</button>
                <span class="vmd:text-xs vmd:text-neutral-500">{{ (zoom * 100).toFixed(0) }}%</span>
                <button class="vmd:text-xs vmd:text-neutral-400 vmd:hover:text-white vmd:px-2" @click="zoomIn">+</button>
            </div>
        </div>
        <div class="vmd:flex-1 vmd:overflow-auto vmd:p-3">
            <TimelineTrack
                v-for="{ instance, requests } in instanceTimelines"
                :key="instance.id"
                :instance="instance"
                :requests="requests"
                :time-range="timeRange"
                :zoom="zoom"
            />
            <div v-if="instanceTimelines.length === 0" class="vmd:text-xs vmd:text-neutral-500 vmd:p-4">
                No instances recorded yet.
            </div>
        </div>
    </div>
</template>
