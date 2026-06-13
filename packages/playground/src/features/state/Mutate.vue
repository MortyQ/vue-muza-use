<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface List { id: string; title: string; totalTasks: number }
interface PaginatedLists { items: List[]; total: number }

const { data, mutate, execute } = useApi<PaginatedLists>("/lists", { immediate: true });

function addFakeList(): void {
    mutate((prev) => ({
        items: [...(prev?.items ?? []), { id: "fake", title: "New List (mutated)", totalTasks: 0 }],
        total: (prev?.total ?? 0) + 1,
    }));
}

function clearData(): void {
    mutate(null);
}

const code = `const { data, mutate } = useApi<PaginatedLists>('/lists', { immediate: true })

// Direct value
mutate({ items: [...data.value.items, newList], total: data.value.total + 1 })

// Updater function (like setState)
mutate((prev) => ({ ...prev, items: [...prev.items, newList] }))`;
</script>

<template>
    <DemoWrapper title="Mutate" description="mutate() updates data without a network request. Supports direct value or updater function." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="addFakeList()">Add Fake List (mutate)</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="clearData()">Clear (mutate null)</button>
        </div>
        <div style="font-size: 13px;">{{ data?.items.length ?? 0 }} lists</div>
        <ul style="margin: 4px 0; padding: 0 0 0 16px; font-size: 13px;">
            <li v-for="list in data?.items?.slice(0, 5)" :key="list.id">{{ list.title }}</li>
        </ul>
    </DemoWrapper>
</template>
