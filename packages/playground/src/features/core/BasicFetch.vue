<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface List { id: string; title: string; totalTasks: number }
interface PaginatedLists { items: List[]; total: number }

const { data, loading, error, execute } = useApi<PaginatedLists>("/lists", { immediate: true });

const code = `const { data, loading, error, execute } = useApi<PaginatedLists>('/lists', {
  immediate: true,
})`;
</script>

<template>
    <DemoWrapper title="Basic Fetch" description="Fetch data on mount with reactive loading and error state." :code="code">
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Loading...</div>
        <div v-else-if="error" style="color: var(--ui-danger)">{{ error.message }}</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="list in data?.items" :key="list.id">{{ list.title }} — {{ list.totalTasks }} tasks</li>
        </ul>
        <button style="margin-top: 16px; padding: 8px 16px; cursor: pointer;" @click="execute()">Refetch</button>
    </DemoWrapper>
</template>
