<script setup lang="ts">
import type { DevtoolsInstance } from "../../../shared/types/index";
import StateDisplay from "./StateDisplay.vue";
defineProps<{ instance: DevtoolsInstance; isActive: boolean }>();
defineEmits<{ (e: "select", id: string): void }>();
</script>

<template>
    <div
        data-vmd-instance-row
        :class="['vmd:flex vmd:items-center vmd:gap-3 vmd:px-3 vmd:py-2 vmd:cursor-pointer vmd:border-b vmd:border-neutral-800 vmd:text-xs',
                 isActive ? 'vmd:bg-neutral-800' : 'vmd:hover:bg-neutral-850']"
        @click="$emit('select', instance.id)"
    >
        <StateDisplay :state="instance.state" />
        <span class="vmd:flex-1 vmd:truncate vmd:text-neutral-200">{{ instance.url ?? "(no url)" }}</span>
        <span class="vmd:text-neutral-500">{{ instance.method }}</span>
        <span class="vmd:text-neutral-500">{{ instance.requestCount }}r</span>
    </div>
</template>
