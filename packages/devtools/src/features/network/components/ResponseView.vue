<script setup lang="ts">
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import KeyValueTable from "../../../shared/components/KeyValueTable.vue";
import CopyButton from "../../../shared/components/CopyButton.vue";
defineProps<{ response: unknown; format: "json" | "kv"; truncated: boolean }>();
defineEmits<{ (e: "toggleFormat"): void }>();
</script>

<template>
    <div class="flex flex-col h-full">
        <div class="flex items-center justify-between px-3 py-1 border-b border-neutral-800">
            <span class="text-xs text-neutral-400">Response</span>
            <div class="flex gap-2">
                <CopyButton :value="JSON.stringify(response, null, 2)" />
                <button class="text-xs text-neutral-400 hover:text-white" @click="$emit('toggleFormat')">
                    {{ format === 'json' ? 'KV' : 'JSON' }}
                </button>
            </div>
        </div>
        <div class="flex-1 overflow-auto p-3">
            <p v-if="truncated" class="text-xs text-yellow-500 mb-2">[truncated]</p>
            <JsonViewer v-if="format === 'json'" :value="response" />
            <KeyValueTable v-else :value="response" />
        </div>
    </div>
</template>
