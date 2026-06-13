<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const concurrency = ref(2);
const { loading, progress, execute } = useApiBatch(
    ["/me", "/lists", "/analytics/summary", "/analytics/popular-tags", "/analytics/tasks-by-priority", "/analytics/daily-activity"],
    { immediate: false, concurrency: concurrency.value },
);

function runWithConcurrency(): void {
    execute();
}

const code = `const { progress, execute } = useApiBatch(urls, {
  concurrency: 2, // limit to 2 in-flight at once
})`;
</script>

<template>
    <DemoWrapper title="Concurrency" description="Limit parallel requests. concurrency: 2 means at most 2 in-flight at once." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>Concurrency (for next run):</label>
            <select v-model="concurrency" style="padding: 4px 8px;">
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="6">unlimited (6)</option>
            </select>
        </div>
        <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px; margin-bottom: 12px;">
            <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.2s' }" />
        </div>
        <div style="font-size: 13px; color: var(--ui-foreground-muted);">{{ progress.completed }} / {{ progress.total }} complete</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" :disabled="loading" @click="runWithConcurrency()">
            {{ loading ? 'Running...' : 'Run Batch' }}
        </button>
    </DemoWrapper>
</template>
