<script setup lang="ts">
import { useTimelineTab } from "../composables/useTimelineTab";
import TimelineTrack from "./TimelineTrack.vue";

const { instanceTimelines, timeRange, statusFilter, zoom, zoomIn, zoomOut } = useTimelineTab();
</script>

<template>
    <div class="flex flex-col h-full">
        <div class="flex items-center gap-3 px-3 py-2 border-b border-neutral-700">
            <select v-model="statusFilter" class="bg-neutral-800 text-xs text-white px-2 py-1 rounded">
                <option value="all">All</option>
                <option v-for="s in ['pending','success','error','aborted']" :key="s" :value="s">{{ s }}</option>
            </select>
            <div class="flex gap-1 ml-auto">
                <button class="text-xs text-neutral-400 hover:text-white px-2" @click="zoomOut">−</button>
                <span class="text-xs text-neutral-500">{{ (zoom * 100).toFixed(0) }}%</span>
                <button class="text-xs text-neutral-400 hover:text-white px-2" @click="zoomIn">+</button>
            </div>
        </div>
        <div class="flex-1 overflow-auto p-3">
            <TimelineTrack
                v-for="{ instance, requests } in instanceTimelines"
                :key="instance.id"
                :instance="instance"
                :requests="requests"
                :time-range="timeRange"
                :zoom="zoom"
            />
            <div v-if="instanceTimelines.length === 0" class="text-xs text-neutral-500 p-4">
                No instances recorded yet.
            </div>
        </div>
    </div>
</template>
