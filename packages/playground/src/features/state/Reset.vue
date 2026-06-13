<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }

const { data, loading, error, execute, reset } = useApi<PaginatedLists>("/lists", {
    immediate: false,
    initialData: { items: [], total: 0 },
});

const code = `const { data, execute, reset } = useApi<PaginatedLists>('/lists', {
  immediate: false,
  initialData: { items: [], total: 0 },
})
reset() // clears data, error, aborts in-flight request`;
</script>

<template>
    <DemoWrapper title="Reset" description="reset() returns state to initialData, clears error, and aborts any in-flight request." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="reset()">Reset</button>
        </div>
        <div style="font-size: 13px;">
            <div>loading: {{ loading }}</div>
            <div>data: {{ data?.items.length ?? 0 }} items</div>
            <div v-if="error" style="color: var(--ui-danger)">error: {{ error.message }}</div>
        </div>
    </DemoWrapper>
</template>
