<script setup lang="ts">
import type { DevtoolsInstance, RequestRecord } from "../../../shared/types/index";
import StateDisplay from "./StateDisplay.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
defineProps<{ instance: DevtoolsInstance; requests: ReadonlyArray<RequestRecord> }>();
defineEmits<{ (e: "close"): void }>();
</script>

<template>
    <div class="h-full flex flex-col gap-3 p-3">
        <div class="flex items-center justify-between">
            <span class="font-semibold text-white">{{ instance.url }}</span>
            <button class="text-neutral-400 hover:text-white" @click="$emit('close')">✕</button>
        </div>
        <StateDisplay :state="instance.state" />
        <div class="text-xs text-neutral-400">
            Requests: {{ instance.requestCount }} · Created: {{ new Date(instance.createdAt).toLocaleTimeString() }}
        </div>
        <div class="text-xs font-semibold text-neutral-300 mt-2">Current data</div>
        <JsonViewer :value="instance.state.data" />
    </div>
</template>
