<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface List { id: string; title: string }
interface PaginatedLists { items: List[]; total: number }

const { data } = useApi<PaginatedLists, unknown, string[]>(
    "/lists",
    { immediate: true, select: (res) => res.items.map((l) => l.title) },
);

const code = `const { data } = useApi<PaginatedLists, unknown, string[]>(
  '/lists',
  {
    immediate: true,
    select: (res) => res.items.map((l) => l.title),
  },
)
// data is string[], not PaginatedLists`;
</script>

<template>
    <DemoWrapper title="Select Transform" description="select transforms the raw response before storing it. data is typed as the output of select." :code="code">
        <p style="color: var(--ui-foreground-muted); font-size: 13px;">data type: string[] (titles only)</p>
        <ul style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="title in data" :key="title">{{ title }}</li>
        </ul>
    </DemoWrapper>
</template>
