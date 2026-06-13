<script setup lang="ts">
import { ref } from "vue";
import { useApi, invalidateCache, clearAllCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }
interface Summary { totalLists: number; totalTasks: number; completedTasks: number }

const log = ref<string[]>([]);
const { execute: fetchA } = useApi<PaginatedLists>("/lists", {
    immediate: true,
    cache: { id: "inv-lists", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /lists fetched from network`),
});

const { execute: fetchB } = useApi<Summary>("/analytics/summary", {
    immediate: true,
    cache: { id: "inv-summary", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /analytics/summary fetched from network`),
});

const code = `// Invalidate specific cache entries
invalidateCache('inv-lists')                       // bust one
invalidateCache(['inv-lists', 'inv-summary'])      // bust many
clearAllCache()                                    // wipe everything`;
</script>

<template>
    <DemoWrapper title="Cache Invalidation" description="invalidateCache busts specific entries. clearAllCache wipes everything." :code="code">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchA()">Fetch /lists</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchB()">Fetch /analytics/summary</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="invalidateCache('inv-lists')">Bust /lists cache</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="clearAllCache()">Clear All Cache</button>
        </div>
        <div style="font-size: 12px; max-height: 120px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
            <div v-if="!log.length" style="color: var(--ui-foreground-muted)">Activity log...</div>
        </div>
    </DemoWrapper>
</template>
