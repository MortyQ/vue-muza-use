<script setup lang="ts">
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import KeyValueTable from "../../../shared/components/KeyValueTable.vue";
import CopyButton from "../../../shared/components/CopyButton.vue";
defineProps<{ payload: unknown; format: "json" | "kv"; truncated: boolean }>();
defineEmits<{ (e: "toggleFormat"): void }>();
</script>

<template>
    <div class="vmd:flex vmd:flex-col vmd:h-full">
        <div class="vmd:flex vmd:items-center vmd:justify-between vmd:px-3 vmd:py-1 vmd:border-b vmd:border-neutral-800">
            <span class="vmd:text-xs vmd:text-neutral-400">Payload</span>
            <div class="vmd:flex vmd:gap-2">
                <CopyButton :value="JSON.stringify(payload, null, 2)" />
                <button class="vmd:text-xs vmd:text-neutral-400 vmd:hover:text-white" @click="$emit('toggleFormat')">
                    {{ format === 'json' ? 'KV' : 'JSON' }}
                </button>
            </div>
        </div>
        <div class="vmd:flex-1 vmd:overflow-auto vmd:p-3">
            <p v-if="truncated" class="vmd:text-xs vmd:text-yellow-500 vmd:mb-2">[truncated]</p>
            <JsonViewer v-if="format === 'json'" :value="payload" />
            <KeyValueTable v-else :value="payload" />
        </div>
    </div>
</template>
