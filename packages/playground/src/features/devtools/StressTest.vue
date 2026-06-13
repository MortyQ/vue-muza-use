<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const ENDPOINTS = ["/me", "/lists", "/analytics/summary", "/analytics/popular-tags", "/analytics/tasks-by-priority", "/analytics/daily-activity"];

const batchSize = ref(20);
const pollerCount = ref(0);
const activePollers = ref<ReturnType<typeof setInterval>[]>([]);

const { loading, progress, execute } = useApiBatch(
    () => Array.from({ length: batchSize.value }, (_, i) => ENDPOINTS[i % ENDPOINTS.length]),
    { immediate: false, concurrency: 5 },
);

function startPollers(): void {
    stopPollers();
    for (let i = 0; i < pollerCount.value; i++) {
        activePollers.value.push(setInterval(() => {
            fetch(import.meta.env.VITE_API_URL + ENDPOINTS[i % ENDPOINTS.length]).catch(() => {});
        }, 1000 + i * 200));
    }
}

function stopPollers(): void {
    activePollers.value.forEach(clearInterval);
    activePollers.value = [];
}

const code = `// Fire 20 parallel requests at once — tests Timeline and Network tab scrolling
// 5 concurrent pollers — tests Timeline multi-track rendering`;
</script>

<template>
    <DemoWrapper title="Stress Test" description="Flood the devtools with requests. Tests Timeline performance, Network tab scrolling, circular buffer." :code="code">
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
            <div>
                <label>Batch size: </label>
                <select v-model="batchSize" style="padding: 4px 8px;">
                    <option :value="10">10</option>
                    <option :value="20">20</option>
                    <option :value="50">50</option>
                </select>
                <button style="margin-left: 8px; padding: 8px 16px; cursor: pointer;" :disabled="loading" @click="execute()">
                    Fire Batch
                </button>
            </div>
            <div>
                <label>Pollers: </label>
                <select v-model="pollerCount" style="padding: 4px 8px;">
                    <option :value="0">0</option>
                    <option :value="3">3</option>
                    <option :value="5">5</option>
                </select>
                <button style="margin-left: 8px; padding: 8px 16px; cursor: pointer;" @click="startPollers()">Start</button>
                <button style="margin-left: 4px; padding: 8px 16px; cursor: pointer;" @click="stopPollers()">Stop</button>
            </div>
        </div>
        <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px; margin-bottom: 8px;">
            <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.2s' }" />
        </div>
        <div style="font-size: 13px;">{{ progress.completed }} / {{ progress.total }} — active pollers: {{ activePollers.length }}</div>
    </DemoWrapper>
</template>
