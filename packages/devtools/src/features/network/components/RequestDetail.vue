<script setup lang="ts">
import type { RequestRecord } from "../../../shared/types/index";
import PayloadView from "./PayloadView.vue";
import ResponseView from "./ResponseView.vue";
import StatusBadge from "./StatusBadge.vue";

defineProps<{
    request: RequestRecord;
    viewMode: "split" | "payload" | "response" | "headers";
    payloadFormat: "json" | "kv";
    responseFormat: "json" | "kv";
}>();
defineEmits<{
    (e: "close"): void;
    (e: "setViewMode", mode: "split" | "payload" | "response" | "headers"): void;
    (e: "togglePayloadFormat"): void;
    (e: "toggleResponseFormat"): void;
}>();
</script>

<template>
    <div class="flex flex-col h-full">
        <div class="flex items-center gap-2 px-3 py-2 border-b border-neutral-700">
            <StatusBadge :status="request.status" :status-code="request.statusCode" />
            <span class="text-xs text-neutral-300 flex-1 truncate">
                {{ request.method }} {{ request.url }}
            </span>
            <div class="flex gap-1 text-xs">
                <button
                    v-for="mode in ['split', 'payload', 'response', 'headers']"
                    :key="mode"
                    :class="viewMode === mode ? 'text-white' : 'text-neutral-500 hover:text-white'"
                    @click="$emit('setViewMode', mode as never)"
                >{{ mode }}</button>
            </div>
            <button class="text-neutral-400 hover:text-white" @click="$emit('close')">✕</button>
        </div>

        <div class="flex flex-1 overflow-hidden">
            <PayloadView
                v-if="viewMode === 'split' || viewMode === 'payload'"
                :class="viewMode === 'split' ? 'w-1/2 border-r border-neutral-800' : 'w-full'"
                :payload="request.payload"
                :format="payloadFormat"
                :truncated="request.truncated"
                @toggle-format="$emit('togglePayloadFormat')"
            />
            <ResponseView
                v-if="viewMode === 'split' || viewMode === 'response'"
                :class="viewMode === 'split' ? 'w-1/2' : 'w-full'"
                :response="request.response"
                :format="responseFormat"
                :truncated="request.truncated"
                @toggle-format="$emit('toggleResponseFormat')"
            />
            <div v-if="viewMode === 'headers'" class="p-3 text-xs w-full">
                <div v-for="(val, key) in request.requestHeaders" :key="key" class="flex gap-2 py-1 border-b border-neutral-800">
                    <span class="text-purple-400">{{ key }}</span>
                    <span class="text-neutral-300">{{ val }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
