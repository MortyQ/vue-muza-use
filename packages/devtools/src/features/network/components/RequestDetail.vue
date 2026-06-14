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
    <div class="vmd:flex vmd:flex-col vmd:h-full">
        <div class="vmd:flex vmd:items-center vmd:gap-2 vmd:px-3 vmd:py-2 vmd:border-b vmd:border-neutral-700">
            <StatusBadge :status="request.status" :status-code="request.statusCode" />
            <span class="vmd:text-xs vmd:text-neutral-300 vmd:flex-1 vmd:truncate">
                {{ request.method }} {{ request.url }}
            </span>
            <div class="vmd:flex vmd:gap-1 vmd:text-xs">
                <button
                    v-for="mode in ['split', 'payload', 'response', 'headers']"
                    :key="mode"
                    :class="viewMode === mode ? 'vmd:text-white' : 'vmd:text-neutral-500 vmd:hover:text-white'"
                    @click="$emit('setViewMode', mode as never)"
                >{{ mode }}</button>
            </div>
            <button class="vmd:text-neutral-400 vmd:hover:text-white" @click="$emit('close')">✕</button>
        </div>

        <div class="vmd:flex vmd:flex-1 vmd:overflow-hidden">
            <PayloadView
                v-if="viewMode === 'split' || viewMode === 'payload'"
                :class="viewMode === 'split' ? 'vmd:w-1/2 vmd:border-r vmd:border-neutral-800' : 'vmd:w-full'"
                :payload="request.payload"
                :format="payloadFormat"
                :truncated="request.truncated"
                @toggle-format="$emit('togglePayloadFormat')"
            />
            <ResponseView
                v-if="viewMode === 'split' || viewMode === 'response'"
                :class="viewMode === 'split' ? 'vmd:w-1/2' : 'vmd:w-full'"
                :response="request.response"
                :format="responseFormat"
                :truncated="request.truncated"
                @toggle-format="$emit('toggleResponseFormat')"
            />
            <div v-if="viewMode === 'headers'" class="vmd:p-3 vmd:text-xs vmd:w-full">
                <div v-for="(val, key) in request.requestHeaders" :key="key" class="vmd:flex vmd:gap-2 vmd:py-1 vmd:border-b vmd:border-neutral-800">
                    <span class="vmd:text-purple-400">{{ key }}</span>
                    <span class="vmd:text-neutral-300">{{ val }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
