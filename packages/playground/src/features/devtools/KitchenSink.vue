<script setup lang="ts">
import { ref } from "vue";
import { useApi, useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

// 1. Polling instance
const { loading: pollingLoading } = useApi("/analytics/summary", { immediate: true, poll: 3000 });

// 2. SWR cache instance
const { revalidating } = useApi("/lists", { immediate: true, cache: { id: "ks-swr", staleTime: 10000, swr: true } });

// 3. Lazy instance (manual trigger)
const { execute: lazyFetch, data: lazyData } = useApi("/me", { lazy: true });

// 4. Error instance
const { error: err404 } = useApi("/lists/00000000-0000-0000-0000-000000000000", { immediate: true, skipErrorNotification: true });

// 5. Batch (5 requests)
const { loading: batchLoading, execute: runBatch } = useApiBatch(
    ["/me", "/lists", "/analytics/summary", "/analytics/popular-tags", "/analytics/tasks-by-priority"],
    { immediate: true },
);

// 6. Debounce instance
const search = ref("");
const { loading: debounceLoading } = useApi(() => `/lists?q=${search.value}`, { debounce: 400 });
</script>

<template>
    <DemoWrapper
        title="Kitchen Sink"
        description="6 useApi instances running simultaneously. Open the devtools panel to see Instances, Network, and Timeline all populated."
    >
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Polling (3s)</strong><br />loading: {{ pollingLoading }}
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>SWR Cache</strong><br />revalidating: {{ revalidating }}
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Lazy</strong><br />
                <button style="margin-top: 4px; padding: 4px 10px; cursor: pointer;" @click="lazyFetch()">Fetch</button>
                <span v-if="lazyData"> ✓</span>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Error (404)</strong><br />
                <span style="color: var(--ui-danger);">{{ err404?.message ?? '...' }}</span>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Batch (5 urls)</strong><br />
                loading: {{ batchLoading }}
                <button style="margin-top: 4px; padding: 4px 10px; cursor: pointer;" @click="runBatch()">Re-run</button>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Debounce search</strong><br />
                <input v-model="search" placeholder="type..." style="width: 100%; padding: 4px; margin-top: 4px; box-sizing: border-box;" />
                <span v-if="debounceLoading"> searching...</span>
            </div>
        </div>
    </DemoWrapper>
</template>
