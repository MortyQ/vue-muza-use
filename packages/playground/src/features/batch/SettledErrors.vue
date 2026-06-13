<script setup lang="ts">
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data, loading, execute } = useApiBatch(
    ["/me", "/lists/00000000-0000-0000-0000-000000000001", "/analytics/summary", "/tasks/00000000-0000-0000-0000-000000000002"],
    { immediate: true, settled: true, skipErrorNotification: true },
);

const code = `const { data } = useApiBatch(
  ['/me', '/lists/nonexistent', '/analytics/summary', '/tasks/nonexistent'],
  { settled: true }, // failed requests don't stop the batch
)`;
</script>

<template>
    <DemoWrapper title="Settled Errors" description="settled: true — failed requests are collected, not thrown. Batch always completes." :code="code">
        <div v-if="loading">Loading...</div>
        <div v-else style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="item in data" :key="item.index"
                :style="{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', background: item.success ? 'var(--ui-success-subtle)' : 'var(--ui-danger-subtle)', color: item.success ? 'var(--ui-success)' : 'var(--ui-danger)' }">
                {{ item.url }}: {{ item.success ? 'OK' : item.error?.message }}
            </div>
        </div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Re-run</button>
    </DemoWrapper>
</template>
