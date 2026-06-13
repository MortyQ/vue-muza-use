<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const requestCount = ref(0);
const lastFetched = ref<string | null>(null);
const { loading, abort } = useApi("/users/1", {
    immediate: true,
    poll: 3000,
    onSuccess: () => {
        requestCount.value++;
        lastFetched.value = new Date().toLocaleTimeString();
    },
});

const code = `const { loading, abort } = useApi('/users/1', {
  immediate: true,
  poll: 3000, // re-fetch every 3 seconds
})`;
</script>

<template>
    <DemoWrapper title="Basic Polling" description="poll: 3000 re-fetches every 3 seconds automatically after each response." :code="code">
        <div style="display: flex; gap: 24px; font-size: 13px; margin-bottom: 12px;">
            <span>Requests: <strong>{{ requestCount }}</strong></span>
            <span>Last: <strong>{{ lastFetched ?? '—' }}</strong></span>
            <span>Loading: <strong>{{ loading }}</strong></span>
        </div>
        <button style="padding: 8px 16px; cursor: pointer;" @click="abort()">Stop Polling</button>
    </DemoWrapper>
</template>
