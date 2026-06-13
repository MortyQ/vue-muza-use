<script setup lang="ts">
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data, loading, progress, execute } = useApiBatch(
    ["/users/1", "/users/2", "/users/3", "/users/4", "/users/5"],
    { immediate: true },
);

const code = `const { data, loading, progress } = useApiBatch(
  ['/users/1', '/users/2', '/users/3', '/users/4', '/users/5'],
  { immediate: true },
)`;
</script>

<template>
    <DemoWrapper title="Basic Batch" description="Execute 5 requests in parallel. progress tracks completed / total." :code="code">
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>{{ progress.completed }} / {{ progress.total }}</span>
                <span>{{ progress.percentage }}%</span>
            </div>
            <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px;">
                <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.3s' }" />
            </div>
        </div>
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Loading...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="item in data" :key="item.index">
                {{ item.success ? (item.data as { name: string }).name : `Error: ${item.error?.message}` }}
            </li>
        </ul>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Re-run</button>
    </DemoWrapper>
</template>
