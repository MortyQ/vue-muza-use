<!-- Reusable data pane: title header with KV toggle + copy, body renders JSON or KV view. -->
<script setup lang="ts">
import { ref } from "vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import KvViewer from "./KvViewer.vue";

const props = defineProps<{
    title: string;
    data: unknown;
    truncated?: boolean;
}>();

const mode = ref<"json" | "kv">("json");

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2));
    } catch {
        /* clipboard unavailable — no-op */
    }
}
</script>

<template>
    <div class="data-pane">
        <div class="pane-header">
            <span class="pane-title">{{ title }}</span>
            <button
                class="pane-action"
                :class="{ 'pane-action--active': mode === 'kv' }"
                @click="mode = mode === 'kv' ? 'json' : 'kv'"
            >KV</button>
            <button class="pane-action" @click="copy">Copy</button>
        </div>
        <div class="pane-body">
            <p v-if="truncated" class="truncated-warning">[truncated]</p>
            <JsonViewer v-if="mode === 'json'" :value="data" />
            <KvViewer v-else :value="data" />
        </div>
    </div>
</template>

<style scoped>
.data-pane {
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
    text-transform: uppercase;
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
.pane-body {
    flex: 1;
    overflow: auto;
    padding: 12px;
}
.pane-body::-webkit-scrollbar { width: 4px; height: 4px; }
.pane-body::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.truncated-warning {
    font-size: 11px;
    color: var(--dt-warning);
    margin-bottom: 8px;
}
</style>
