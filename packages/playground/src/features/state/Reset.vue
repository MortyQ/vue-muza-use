<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const { data, loading, error, execute, reset } = useApi<User[]>("/users", {
    immediate: false,
    initialData: [],
});

const code = `const { data, execute, reset } = useApi<User[]>('/users', {
  immediate: false,
  initialData: [], // data starts as [] not null
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
            <div>data: {{ data?.length ?? 0 }} items</div>
            <div v-if="error" style="color: var(--ui-danger)">error: {{ error.message }}</div>
        </div>
    </DemoWrapper>
</template>
