<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const refetchCount = ref(0);
useApi("/analytics/summary", {
    immediate: true,
    refetchOnReconnect: true,
    onSuccess: () => refetchCount.value++,
});

const code = `useApi('/analytics/summary', {
  refetchOnReconnect: true,
  // fires on browser 'online' event — no throttle, reconnect is already rare
})`;
</script>

<template>
    <DemoWrapper title="Refetch on Reconnect" description="Refetches when the browser regains network connectivity." :code="code">
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">
            Use browser DevTools → Network → throttle to "Offline", then back to "Online".
        </p>
        <div style="font-size: 13px;">Reconnect refetches: <strong>{{ refetchCount }}</strong></div>
    </DemoWrapper>
</template>
