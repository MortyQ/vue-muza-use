<!-- Payload pane: two sections — Query Params (top) and Body (bottom). Persists KV/JSON format. -->
<script lang="ts">
import { ref } from "vue";
import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";
import type { PayloadFormat } from "../../../shared/types/index";

// Module-level singleton — survives tab remounts, IndexedDB loaded only once
const _payloadFormat = ref<PayloadFormat>("kv");
let _payloadFormatLoaded = false;
</script>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";

const props = defineProps<{
    queryParams: unknown;
    payload: unknown;
    truncated: boolean;
}>();

const format = _payloadFormat;

if (!_payloadFormatLoaded) {
    _payloadFormatLoaded = true;
    loadPayloadFormat().then((v) => { _payloadFormat.value = v; });
}

const queryParamKeys = computed((): string[] => {
    if (
        props.queryParams === null ||
        props.queryParams === undefined ||
        typeof props.queryParams !== "object"
    ) return [];
    // safe: null/undefined/non-object ruled out above
    return Object.keys(props.queryParams as object);
});

const hasQueryParams = computed(() => queryParamKeys.value.length > 0);
const queryParamCount = computed((): number => queryParamKeys.value.length);
const hasBody = computed(() => props.payload !== null && props.payload !== undefined);

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
                :title="format === 'kv' ? 'Switch to JSON view' : 'Switch to Key-Value view'"
                @click="toggleFormat"
            ><Icon icon="lucide:list-tree" width="13" height="13" /></button>
            <button class="pane-action" @click="copy">Copy</button>
        </div>

        <!-- Query Params section — hidden entirely when empty -->
        <template v-if="hasQueryParams">
            <div class="section-label">
                <span>Query Params</span>
                <span class="section-count">{{ queryParamCount }}</span>
            </div>
            <div class="section-body">
                <TreeViewer v-if="format === 'kv'" :value="queryParams" />
                <JsonViewer v-else :value="queryParams" />
            </div>
        </template>

        <div v-if="hasQueryParams && hasBody" class="section-divider" />

        <!-- Body section — hidden entirely when empty -->
        <template v-if="hasBody">
            <div class="section-label"><span>Body</span></div>
            <div class="section-body">
                <p v-if="truncated" class="truncated-warning">[truncated]</p>
                <TreeViewer v-if="format === 'kv'" :value="payload" />
                <JsonViewer v-else :value="payload" />
            </div>
        </template>

        <!-- Single placeholder when both sections are empty -->
        <p v-if="!hasQueryParams && !hasBody" class="section-empty payload-empty">
            No payload
        </p>
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
    flex: 1;
    min-height: 0;
}
.section-body::-webkit-scrollbar { width: 4px; height: 4px; }
.section-body::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.section-empty {
    padding: 8px 12px;
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: var(--dt-foreground-secondary);
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
.payload-empty {
    text-align: center;
    padding: 16px 0;
}
</style>
