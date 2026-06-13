<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const { data, loading, execute } = useApi<User[]>("/users", { lazy: true });

const code = `const { data, loading, execute } = useApi<User[]>('/users', {
  lazy: true, // no auto-fetch, no reactive tracking
})
// call execute() manually when needed`;
</script>

<template>
    <DemoWrapper title="Lazy Mode" description="lazy: true disables auto-tracking. Fetch only when execute() is called." :code="code">
        <div v-if="!data && !loading" style="color: var(--ui-foreground-muted)">No data yet — click Fetch.</div>
        <div v-if="loading">Loading...</div>
        <div v-if="data">Loaded {{ data.length }} users.</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
    </DemoWrapper>
</template>
