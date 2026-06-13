<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }

const limit = ref(3);
const { data, loading } = useApi<PaginatedLists>(() => `/lists?limit=${limit.value}`, { immediate: true });

const code = `const limit = ref(3)
const { data, loading } = useApi<PaginatedLists>(() => \`/lists?limit=\${limit.value}\`, {
  immediate: true,
})
// changing limit.value auto-triggers a new request`;
</script>

<template>
    <DemoWrapper title="Dynamic URL" description="Reactive URL — changing the limit triggers a new request automatically." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button v-for="n in [1, 3, 5]" :key="n" @click="limit = n"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: limit === n ? 700 : 400 }">
                Limit {{ n }}
            </button>
        </div>
        <div v-if="loading">Loading...</div>
        <div v-else-if="data">{{ data.items.length }} lists (total: {{ data.total }})</div>
    </DemoWrapper>
</template>
