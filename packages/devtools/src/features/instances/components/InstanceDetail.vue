<script setup lang="ts">
import type { DevtoolsInstance, RequestRecord } from "../../../shared/types/index";
import StateDisplay from "./StateDisplay.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
defineProps<{ instance: DevtoolsInstance; requests: ReadonlyArray<RequestRecord> }>();
defineEmits<{ (e: "close"): void }>();
</script>

<template>
    <div class="vmd:h-full vmd:flex vmd:flex-col vmd:gap-3 vmd:p-3">
        <div class="vmd:flex vmd:items-center vmd:justify-between">
            <span class="vmd:font-semibold vmd:text-white">{{ instance.url }}</span>
            <button class="vmd:text-neutral-400 vmd:hover:text-white" @click="$emit('close')">✕</button>
        </div>
        <StateDisplay :state="instance.state" />
        <div class="vmd:text-xs vmd:text-neutral-400">
            Requests: {{ instance.requestCount }} · Created: {{ new Date(instance.createdAt).toLocaleTimeString() }}
        </div>
        <div class="vmd:text-xs vmd:font-semibold vmd:text-neutral-300 vmd:mt-2">Current data</div>
        <JsonViewer :value="instance.state.data" />
    </div>
</template>
