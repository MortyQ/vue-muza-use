<!-- Payload pane: two sections — Query Params (top) and Body (bottom). Persists KV/JSON format. -->
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";
import type { PayloadFormat } from "../../../shared/types/index";

const props = defineProps<{
    queryParams: unknown;
    payload: unknown;
    truncated: boolean;
}>();

const format = ref<PayloadFormat>("kv");

const hasQueryParams = computed(
    () =>
        props.queryParams !== null &&
        props.queryParams !== undefined &&
        typeof props.queryParams === "object" &&
        Object.keys(props.queryParams as object).length > 0,
    // safe: hasQueryParams guards non-null object before cast
);

const queryParamCount = computed((): number => {
    if (!hasQueryParams.value) return 0;
    // safe: hasQueryParams guarantees non-null object
    return Object.keys(props.queryParams as object).length;
});

const hasBody = computed(() => props.payload !== null && props.payload !== undefined);

onMounted(async () => {
    format.value = await loadPayloadFormat();
});

async function toggleFormat(): Promise<void> {
    format.value = format.value === "kv" ? "json" : "kv";
    await savePayloadFormat(format.value);
}

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(JSON.stringify(props.payload, null, 2));
    } catch {
        /* clipboard unavailable — no-op */
    }
}
</script>

<template>
    <div class="payload-pane">
        <div class="pane-header">
            <span class="pane-title">PAYLOAD</span>
            <button
                class="pane-action"
                :class="{ 'pane-action--active': format === 'kv' }"
                @click="toggleFormat"
            >KV</button>
            <button class="pane-action" @click="copy">Copy</button>
        </div>

        <!-- Query Params section -->
        <div class="section-label">
            <span>Query Params</span>
            <span v-if="hasQueryParams" class="section-count">{{ queryParamCount }}</span>
        </div>
        <div v-if="hasQueryParams" class="section-body">
            <TreeViewer v-if="format === 'kv'" :value="queryParams" />
            <JsonViewer v-else :value="queryParams" />
        </div>
        <p v-else class="section-empty">No params</p>

        <div class="section-divider" />

        <!-- Body section -->
        <div class="section-label"><span>Body</span></div>
        <div v-if="hasBody" class="section-body">
            <p v-if="truncated" class="truncated-warning">[truncated]</p>
            <TreeViewer v-if="format === 'kv'" :value="payload" />
            <JsonViewer v-else :value="payload" />
        </div>
        <p v-else class="section-empty">No body</p>
    </div>
</template>

<style scoped>
.payload-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}
.pane-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.pane-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.6px;
    color: var(--dt-foreground-muted);
    flex: 1;
}
.pane-action {
    height: 22px;
    padding: 0 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--dt-border);
    background: transparent;
    color: var(--dt-foreground-muted);
    transition: all 0.12s;
    flex-shrink: 0;
}
.pane-action:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
    border-color: var(--dt-border-strong);
}
.pane-action--active {
    background: var(--dt-primary-subtle);
    color: var(--dt-primary);
    border-color: var(--dt-primary);
}
.section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dt-foreground-subtle);
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.section-count {
    background: var(--dt-primary-subtle);
    color: var(--dt-primary);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 9px;
}
.section-body {
    overflow: auto;
    padding: 6px 12px;
    flex-shrink: 0;
    max-height: 50%;
}
.section-body::-webkit-scrollbar { width: 4px; height: 4px; }
.section-body::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.section-empty {
    padding: 8px 12px;
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: var(--dt-foreground-subtle);
    flex-shrink: 0;
}
.section-divider {
    height: 1px;
    background: var(--dt-border-subtle);
    flex-shrink: 0;
}
.truncated-warning {
    font-size: 11px;
    color: var(--dt-warning);
    margin-bottom: 8px;
}
</style>
