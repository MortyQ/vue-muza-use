<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const refetchCount = ref(0);
useApi("/analytics/summary", {
    immediate: true,
    refetchOnFocus: { throttle: 5000 },
    onSuccess: () => refetchCount.value++,
});

const code = `useApi('/analytics/summary', {
  refetchOnFocus: { throttle: 5000 },
  // throttle: 5000 — won't refetch again within 5s of last fetch
})`;
</script>

<template>
    <DemoWrapper title="Refetch on Focus" description="Refetches when the browser tab regains focus. throttle: 5000 prevents rapid re-triggers." :code="code">
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">Switch to another tab, wait a moment, then come back.</p>
        <div style="font-size: 13px;">Refetch count: <strong>{{ refetchCount }}</strong></div>
    </DemoWrapper>
</template>
