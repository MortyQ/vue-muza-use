<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface List { id: string; title: string }
interface PaginatedLists { items: List[]; total: number }

const search = ref("");
const { data, loading } = useApi<PaginatedLists>(
    () => search.value ? `/lists?q=${search.value}` : "/lists",
    { immediate: true, debounce: 500 },
);

const code = `const search = ref('')
const { data, loading } = useApi<PaginatedLists>(
  () => search.value ? \`/lists?q=\${search.value}\` : '/lists',
  { immediate: true, debounce: 500 },
)`;
</script>

<template>
    <DemoWrapper title="Debounce" description="debounce: 500 waits 500ms after the last change before firing the request." :code="code">
        <input v-model="search" placeholder="Search lists..." style="width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 12px;" />
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Searching...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="list in data?.items" :key="list.id">{{ list.title }}</li>
        </ul>
    </DemoWrapper>
</template>
