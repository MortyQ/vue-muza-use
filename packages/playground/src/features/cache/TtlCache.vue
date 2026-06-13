<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useApi, invalidateCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const STALE_TIME = 15_000;
const source = ref<"network" | "cache">("network");
const requestCount = ref(0);
const ttlRemaining = ref(0);
let ttlTimer: ReturnType<typeof setInterval>;

const { data, execute } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "demo-ttl", staleTime: STALE_TIME },
    onSuccess: () => { requestCount.value++; source.value = "network"; ttlRemaining.value = STALE_TIME / 1000; },
});

onMounted(() => {
    ttlTimer = setInterval(() => { ttlRemaining.value = Math.max(0, ttlRemaining.value - 1); }, 1000);
});
onUnmounted(() => clearInterval(ttlTimer));

const code = `const { data } = useApi<User[]>('/users', {
  immediate: true,
  cache: { id: 'demo-ttl', staleTime: 15_000 },
})`;
</script>

<template>
    <DemoWrapper title="TTL Cache" description="Cache hit returns data instantly without a network request. Expires after 15s." :code="code">
        <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <span>Source: <strong>{{ source }}</strong></span>
            <span>Requests: <strong>{{ requestCount }}</strong></span>
            <span>TTL: <strong>{{ ttlRemaining }}s</strong></span>
        </div>
        <div v-if="data">{{ data.length }} users cached.</div>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch (uses cache if valid)</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="invalidateCache('demo-ttl')">Invalidate Cache</button>
        </div>
    </DemoWrapper>
</template>
