<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const log = ref<string[]>([]);
const { loading, execute } = useApi("/lists/00000000-0000-0000-0000-000000000000", {
    retry: 2,
    retryDelay: 500,
    retryStatusCodes: [404, 500],
    skipErrorNotification: true,
    onError: (err) => log.value.unshift(`[${new Date().toLocaleTimeString()}] status ${err.status}: ${err.message}`),
});

const code = `useApi('/lists/nonexistent-id', {
  retry: 2,
  retryStatusCodes: [404, 500], // only retry on these specific codes
  // default: [408, 429, 500, 502, 503, 504]
})`;
</script>

<template>
    <DemoWrapper title="Custom Status Codes" description="retryStatusCodes controls which HTTP status codes trigger a retry." :code="code">
        <button style="padding: 8px 16px; cursor: pointer; margin-bottom: 12px;" :disabled="loading" @click="execute()">
            {{ loading ? 'Retrying...' : 'Trigger (retries on 404)' }}
        </button>
        <div style="font-size: 12px; max-height: 100px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
            <div v-if="!log.length" style="color: var(--ui-foreground-muted)">Click to trigger...</div>
        </div>
    </DemoWrapper>
</template>
