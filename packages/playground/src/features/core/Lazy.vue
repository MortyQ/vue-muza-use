<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }

const { data, loading, execute } = useApi<PaginatedLists>("/lists", { lazy: true });

const code = `const { data, loading, execute } = useApi<PaginatedLists>('/lists', {
  lazy: true, // no auto-fetch, no reactive tracking
})
// call execute() manually when needed`;
</script>

<template>
    <DemoWrapper title="Lazy Mode" description="lazy: true disables auto-tracking. Fetch only when execute() is called." :code="code">
        <div v-if="!data && !loading" style="color: var(--ui-foreground-muted)">No data yet — click Fetch.</div>
        <div v-if="loading">Loading...</div>
        <div v-if="data">Loaded {{ data.total }} lists.</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
    </DemoWrapper>
</template>
