<script setup lang="ts">
import { ref } from "vue";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";
import CoalesceScenario from "./CoalesceScenario.vue";

// coalesce/cache are setup-time options — remount the scenario (via :key) to switch
const useCoalesce = ref(true);
const useCache = ref(true);

const code = `const q = ref("");
const page = ref(3);           // user is on page 3...
const sort = ref("title");     // ...with a custom sort
const order = ref("asc");

const { data, loading } = useApi<ListsResponse>("/lists", {
    params: () => ({
        q: q.value,
        limit: 3,
        offset: (page.value - 1) * 3,
        sort: sort.value,   // createdAt | updatedAt | title | deadline
        order: order.value, // asc | desc
    }),
    immediate: true,
    // coalesce: true is the 1.7 default — same-flush triggers collapse
    // into ONE request with the final values. Set false for the old
    // per-trigger behavior (2 requests, first aborted mid-flight).
    cache: true, // auto key from method+url+params — one entry per final params combo
});

// One search change mutates page + sort in the same flush:
watch(q, () => {
    page.value = 1;
    sort.value = "createdAt";
    order.value = "desc";
});`;
</script>

<template>
    <DemoWrapper
        title="Trigger Coalescing (1.7)"
        description="Steps 1-2 set page/sort away from defaults, step 3 changes search — the reset watch snaps page/sort back in the same flush. With coalesce ON: exactly one request with the final values (page=1, sort=date:desc). With coalesce OFF: two requests — the first with stale page/sort, aborted but still sent to the backend."
        :code="code"
    >
        <div style="display: flex; gap: 20px; margin-bottom: 16px; font-size: 13px; flex-wrap: wrap;">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input v-model="useCoalesce" type="checkbox" />
                coalesce: <strong>{{ useCoalesce }}</strong>
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input v-model="useCache" type="checkbox" />
                cache (auto keys): <strong>{{ useCache }}</strong>
            </label>
            <span style="color: var(--ui-foreground-muted, #888); align-self: center;">toggling remounts the demo and resets counters</span>
        </div>
        <CoalesceScenario :key="`${useCoalesce}-${useCache}`" :coalesce="useCoalesce" :cache="useCache" />
    </DemoWrapper>
</template>
