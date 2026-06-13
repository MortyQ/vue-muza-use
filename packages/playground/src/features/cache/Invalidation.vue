<script setup lang="ts">
import { ref } from "vue";
import { useApi, invalidateCache, clearAllCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const log = ref<string[]>([]);
const { execute: fetchA } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "inv-users", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /users fetched from network`),
});

const { execute: fetchB } = useApi<User>("/users/1", {
    immediate: true,
    cache: { id: "inv-user-1", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /users/1 fetched from network`),
});

const code = `// Invalidate specific cache entries
invalidateCache('inv-users')       // bust one
invalidateCache(['inv-users', 'inv-user-1']) // bust many
clearAllCache()                    // wipe everything`;
</script>

<template>
    <DemoWrapper title="Cache Invalidation" description="invalidateCache busts specific entries. clearAllCache wipes everything." :code="code">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchA()">Fetch /users</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchB()">Fetch /users/1</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="invalidateCache('inv-users')">Bust /users cache</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="clearAllCache()">Clear All Cache</button>
        </div>
        <div style="font-size: 12px; max-height: 120px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
            <div v-if="!log.length" style="color: var(--ui-foreground-muted)">Activity log...</div>
        </div>
    </DemoWrapper>
</template>
