<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const attemptLog = ref<string[]>([]);
const { loading, error, execute } = useApi("/users/999", {
    retry: 3,
    retryDelay: 800,
    skipErrorNotification: true,
    onError: (err) => attemptLog.value.unshift(`[${new Date().toLocaleTimeString()}] ${err.message}`),
});

const code = `const { loading, error } = useApi('/users/999', {
  retry: 3,        // up to 3 retries
  retryDelay: 800, // 800ms between attempts
})`;
</script>

<template>
    <DemoWrapper title="Auto Retry" description="retry: 3 retries failed requests up to 3 times before surfacing the error." :code="code">
        <button style="padding: 8px 16px; cursor: pointer; margin-bottom: 12px;" :disabled="loading" @click="execute()">
            {{ loading ? 'Retrying...' : 'Trigger Request (404 endpoint)' }}
        </button>
        <div v-if="error" style="color: var(--ui-danger); font-size: 13px; margin-bottom: 8px;">Final error: {{ error.message }}</div>
        <div style="font-size: 12px; max-height: 100px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in attemptLog" :key="i">{{ entry }}</div>
            <div v-if="!attemptLog.length" style="color: var(--ui-foreground-muted)">Click to trigger...</div>
        </div>
    </DemoWrapper>
</template>
