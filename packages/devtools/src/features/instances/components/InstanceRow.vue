<script setup lang="ts">
import type { DevtoolsInstance } from "../../../shared/types/index";
import StateDisplay from "./StateDisplay.vue";
defineProps<{ instance: DevtoolsInstance; isActive: boolean }>();
defineEmits<{ (e: "select", id: string): void }>();
</script>

<template>
    <div
        data-vmd-instance-row
        :class="['flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-neutral-800 text-xs',
                 isActive ? 'bg-neutral-800' : 'hover:bg-neutral-850']"
        @click="$emit('select', instance.id)"
    >
        <StateDisplay :state="instance.state" />
        <span class="flex-1 truncate text-neutral-200">{{ instance.url ?? "(no url)" }}</span>
        <span class="text-neutral-500">{{ instance.method }}</span>
        <span class="text-neutral-500">{{ instance.requestCount }}r</span>
    </div>
</template>
