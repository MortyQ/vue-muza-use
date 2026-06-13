<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }

const limit = ref(3);
const requestCount = ref(0);
const { data, ignoreUpdates } = useApi<PaginatedLists>(
    () => `/lists?limit=${limit.value}`,
    { immediate: true, onSuccess: () => requestCount.value++ },
);

function changeSilently(): void {
    ignoreUpdates(() => { limit.value = Math.floor(Math.random() * 5) + 1; });
}

const code = `const { ignoreUpdates } = useApi(() => \`/lists?limit=\${limit.value}\`, {
  immediate: true,
})

// Change limit without triggering a re-fetch
ignoreUpdates(() => { limit.value = 5 })`;
</script>

<template>
    <DemoWrapper title="Ignore Updates" description="ignoreUpdates() lets you mutate reactive deps without triggering a re-fetch." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="limit = Math.floor(Math.random() * 5) + 1">
                Change limit (triggers fetch)
            </button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="changeSilently()">
                Change limit (ignoreUpdates — no fetch)
            </button>
        </div>
        <div style="font-size: 13px;">
            <div>limit: <strong>{{ limit }}</strong></div>
            <div>Requests: <strong>{{ requestCount }}</strong></div>
            <div v-if="data">items: {{ data.items.length }} / total: {{ data.total }}</div>
        </div>
    </DemoWrapper>
</template>
