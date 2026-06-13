<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const lastUpdated = ref<string | null>(null);
const { data, revalidating, execute } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "demo-swr", staleTime: 10_000, swr: true },
    onSuccess: () => { lastUpdated.value = new Date().toLocaleTimeString(); },
});

const code = `const { data, revalidating } = useApi<User[]>('/users', {
  immediate: true,
  cache: { id: 'demo-swr', staleTime: 10_000, swr: true },
})
// data shows instantly from cache, revalidating: true while fetching fresh`;
</script>

<template>
    <DemoWrapper title="SWR" description="Stale-While-Revalidate: show cached data immediately, fetch fresh in background." :code="code">
        <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <span>Revalidating: <strong>{{ revalidating }}</strong></span>
            <span v-if="lastUpdated">Last updated: <strong>{{ lastUpdated }}</strong></span>
        </div>
        <div v-if="data">{{ data.length }} users. Data shows instantly from cache on second load.</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Refetch</button>
    </DemoWrapper>
</template>
