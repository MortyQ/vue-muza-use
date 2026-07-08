<script setup lang="ts">
import { ref } from "vue";
import { useApi, invalidateCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface PaginatedLists { items: { id: string; title: string }[]; total: number }

const page = ref(1);
const requestLog = ref<string[]>([]);

// cache: true — no manual `id`, so the key is derived from method + url + params.
// Each page gets its own cache entry automatically; swr/staleTime/freshFor here
// come from globalOptions.cacheDefaults (see app/main.ts) since none are set locally.
const { data, loading, revalidating, cacheKey, execute } = useApi<PaginatedLists>("/lists", {
    cache: true,
    immediate: true,
    params: () => ({ limit: page.value }),
    onSuccess: () => {
        requestLog.value.unshift(`[${new Date().toLocaleTimeString()}] network fetch — limit ${page.value}`);
    },
});

function invalidateCurrentPage() {
    if (!cacheKey.value) return;
    invalidateCache(cacheKey.value);
    execute();
}

function invalidateAllPages() {
    invalidateCache({ prefix: "auto:GET:/lists" });
    execute();
}

const code = `const page = ref(1)

// No manual id — key auto-derives from method + url + params.
// swr / staleTime / freshFor come from globalOptions.cacheDefaults.
const { data, cacheKey, execute } = useApi<PaginatedLists>('/lists', {
  cache: true,
  immediate: true,
  params: () => ({ limit: page.value }),
})

// Bust only this variation's entry, then refetch it
invalidateCache(cacheKey.value!)
execute()

// Or bust every cached page of this endpoint at once
invalidateCache({ prefix: 'auto:GET:/lists' })`;
</script>

<template>
    <DemoWrapper
        title="Auto Cache Keys"
        description="cache: true derives a unique key per page/params combo — no manual id, no wrong-page cache hits."
        :code="code"
    >
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button
                v-for="n in [1, 2, 3]"
                :key="n"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: page === n ? 700 : 400 }"
                @click="page = n"
            >
                Limit {{ n }}
            </button>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; font-size: 13px;">
            <span>Loading: <strong>{{ loading }}</strong></span>
            <span>Revalidating: <strong>{{ revalidating }}</strong></span>
        </div>

        <div style="font-size: 12px; font-family: monospace; word-break: break-all; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px; margin-bottom: 12px;">
            cacheKey: {{ cacheKey ?? "—" }}
        </div>

        <div v-if="data">{{ data.items?.length }} lists on this page (total: {{ data.total }})</div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="invalidateCurrentPage">
                Invalidate this page's cache
            </button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="invalidateAllPages">
                Invalidate all cached pages
            </button>
        </div>

        <div style="font-size: 12px; max-height: 120px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px; margin-top: 12px;">
            <div v-for="(entry, i) in requestLog" :key="i">{{ entry }}</div>
            <div v-if="!requestLog.length" style="color: var(--ui-foreground-muted)">Activity log...</div>
        </div>
    </DemoWrapper>
</template>
