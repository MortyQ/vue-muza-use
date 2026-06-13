<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const userId = ref(1);
const requestCount = ref(0);
const { data, ignoreUpdates } = useApi<{ id: number; name: string }>(
    () => `/users/${userId.value}`,
    { immediate: true, onSuccess: () => requestCount.value++ },
);

function changeSilently(): void {
    ignoreUpdates(() => { userId.value = Math.floor(Math.random() * 10) + 1; });
}

const code = `const { ignoreUpdates } = useApi(() => \`/users/\${userId.value}\`, {
  immediate: true,
})

// Change userId without triggering a re-fetch
ignoreUpdates(() => { userId.value = 5 })`;
</script>

<template>
    <DemoWrapper title="Ignore Updates" description="ignoreUpdates() lets you mutate reactive deps without triggering a re-fetch." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="userId = Math.floor(Math.random() * 10) + 1">
                Change userId (triggers fetch)
            </button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="changeSilently()">
                Change userId (ignoreUpdates — no fetch)
            </button>
        </div>
        <div style="font-size: 13px;">
            <div>userId: <strong>{{ userId }}</strong></div>
            <div>Requests: <strong>{{ requestCount }}</strong></div>
            <div v-if="data">data: {{ data.name }}</div>
        </div>
    </DemoWrapper>
</template>
