<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import { apiAxios } from "@/shared/api/axios";

interface ListItem { id: string; title: string; totalTasks: number; completedTasks: number }
interface ListsResponse {
    data: ListItem[];
    pagination: { total: number; limit: number; offset: number; currentPage: number; totalPages: number };
}

const props = defineProps<{ coalesce: boolean; cache: boolean }>();

const LIMIT = 3;

// --- the real-world table state ---------------------------------------
const q = ref("");
const page = ref(1);              // UI page → sent as offset
const sort = ref("createdAt");    // createdAt | updatedAt | title | deadline
const order = ref("desc");        // asc | desc

// --- wire-level request counter ----------------------------------------
// An axios request interceptor counts every /lists request that actually
// leaves the client — including ones that get aborted a microtask later.
const sentLog = ref<string[]>([]);
const interceptorId = apiAxios.interceptors.request.use((config) => {
    if (config.url?.includes("/lists")) {
        const p = (config.params ?? {}) as Record<string, unknown>;
        sentLog.value.push(
            `#${sentLog.value.length + 1} → q="${p.q}" offset=${p.offset} sort=${p.sort}:${p.order}`,
        );
    }
    return config;
});
onUnmounted(() => apiAxios.interceptors.request.eject(interceptorId));

// --- the request (composable declared BEFORE the reset watch — the order
// that used to produce the double request) ------------------------------
const { data, loading, revalidating, cacheKey } = useApi<ListsResponse>("/lists", {
    params: () => ({
        q: q.value,
        limit: LIMIT,
        offset: (page.value - 1) * LIMIT,
        sort: sort.value,
        order: order.value,
    }),
    immediate: true,
    coalesce: props.coalesce,
    // cache: true → auto key from method + url + params. With coalesce ON a
    // filter change writes ONE entry under the final key; with coalesce OFF
    // the doomed first request also reads/keys a transient auto key.
    // (Playground globalOptions.cacheDefaults add swr + freshFor "1m".)
    ...(props.cache ? { cache: true } : {}),
});

// The reset watch from the bug report: one search change mutates page and
// sort in the same flush.
watch(q, () => {
    page.value = 1;
    sort.value = "createdAt";
    order.value = "desc";
});

// Cycles through fixed values so the 4th press returns to the same q +
// reset page/sort → identical auto cache key → observable cache hit
// (fresh entry: data appears instantly, request counter does NOT grow).
const words = ["work", "home", "vue"];
let wordIdx = 0;
function changeSearch(): void {
    q.value = words[wordIdx++ % words.length] ?? "work";
}

function setSortTitleAsc(): void {
    sort.value = "title";
    order.value = "asc";
}
</script>

<template>
    <div>
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="page = 3">
                1. Set page = 3
            </button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="setSortTitleAsc()">
                2. Set sort = title:asc
            </button>
            <button style="padding: 8px 16px; cursor: pointer; font-weight: 600;" @click="changeSearch()">
                3. Change search (q) → reset watch fires
            </button>
        </div>

        <div style="font-size: 13px; margin-bottom: 12px;">
            <div>q: <strong>{{ q || "—" }}</strong> · page: <strong>{{ page }}</strong> (offset {{ (page - 1) * LIMIT }}) · sort: <strong>{{ sort }}:{{ order }}</strong></div>
            <div>
                loading: <strong>{{ loading }}</strong> · revalidating: <strong>{{ revalidating }}</strong>
                <span v-if="data"> · lists: {{ data.data.length }} / total: {{ data.pagination.total }} · page {{ data.pagination.currentPage }}/{{ data.pagination.totalPages }}</span>
            </div>
            <div v-if="cacheKey" style="font-family: monospace; font-size: 11px; word-break: break-all; color: var(--ui-foreground-muted, #888);">
                cacheKey: {{ cacheKey }}
            </div>
        </div>

        <div style="font-size: 13px;">
            <div style="margin-bottom: 4px;">
                Requests sent to the backend: <strong>{{ sentLog.length }}</strong>
            </div>
            <div style="font-family: monospace; font-size: 12px; display: flex; flex-direction: column; gap: 2px;">
                <div v-for="line in sentLog" :key="line">{{ line }}</div>
            </div>
        </div>
    </div>
</template>
