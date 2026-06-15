<!-- Recursive tree node. Both the ▶/▼ arrow and the Object/Array badge toggle expand. -->
<script lang="ts">
export default { name: "TreeNode" }
</script>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
    nodeKey: string | number | null;
    value: unknown;
    depth: number;
}>();

const expanded = ref(false);

const isExpandable = computed(
    () => typeof props.value === "object" && props.value !== null,
);
const isArray = computed(() => Array.isArray(props.value));

const badgeLabel = computed((): string => {
    if (!isExpandable.value) return "";
    // safe: isExpandable guarantees non-null object; isArray narrows to array
    if (isArray.value) return `Array [${(props.value as unknown[]).length}]`;
    // safe: isExpandable guarantees non-null object, not an array
    return `Object {${Object.keys(props.value as object).length}}`;
});

const childEntries = computed((): Array<[string | number, unknown]> => {
    if (!expanded.value || !isExpandable.value) return [];
    // safe: isExpandable guarantees non-null object; isArray narrows to array
    if (isArray.value) return (props.value as unknown[]).map((v, i) => [i, v]);
    // safe: isExpandable guarantees non-null object, not an array
    return Object.entries(props.value as Record<string, unknown>);
});

const displayValue = computed((): string => {
    if (props.value === null) return "null";
    if (typeof props.value === "string") return `"${props.value}"`;
    return String(props.value);
});

const valueClass = computed((): string => {
    if (props.value === null) return "tree-val tree-val--null";
    if (typeof props.value === "string") return "tree-val tree-val--string";
    if (typeof props.value === "number") return "tree-val tree-val--number";
    if (typeof props.value === "boolean") return "tree-val tree-val--boolean";
    return "tree-val";
});

const indentPx = computed(() => props.depth * 14);

function toggle(): void {
    if (isExpandable.value) expanded.value = !expanded.value;
}
</script>

<template>
    <div class="tree-node">
        <div class="tree-row" :style="{ paddingLeft: indentPx + 'px' }">
            <span
                class="tree-arrow"
                :style="{ visibility: isExpandable ? 'visible' : 'hidden' }"
                @click="toggle"
            >{{ expanded ? "▼" : "▶" }}</span>
            <span v-if="nodeKey !== null" class="tree-key">{{ nodeKey }}</span>
            <span v-if="nodeKey !== null" class="tree-colon">:</span>
            <span v-if="isExpandable" class="tree-badge" @click="toggle">
                {{ badgeLabel }}
            </span>
            <span v-else :class="valueClass">{{ displayValue }}</span>
        </div>
        <TreeNode
            v-for="[k, v] in childEntries"
            :key="k"
            :node-key="k"
            :value="v"
            :depth="depth + 1"
        />
    </div>
</template>

<style scoped>
.tree-node { font-family: "SF Mono", "Fira Code", Consolas, monospace; font-size: 12px; }
.tree-row {
    display: flex;
    align-items: center;
    gap: 3px;
    line-height: 1.7;
    min-height: 22px;
}
.tree-row:hover { background: var(--dt-surface-raised, #ffffff08); }
.tree-arrow {
    width: 14px;
    flex-shrink: 0;
    color: var(--dt-foreground-subtle, #6b7280);
    font-size: 8px;
    cursor: pointer;
    user-select: none;
}
.tree-arrow:hover { color: var(--dt-primary, #a78bfa); }
.tree-key { color: oklch(72% 0.17 290); flex-shrink: 0; }
.tree-colon { color: var(--dt-border-strong, #374151); flex-shrink: 0; }
.tree-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--dt-surface-raised, #1e1b4b);
    border: 1px solid var(--dt-border, #3730a3);
    color: oklch(72% 0.17 260);
    border-radius: 3px;
    padding: 0 6px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
}
.tree-badge:hover {
    background: var(--dt-primary-subtle, #312e81);
    color: var(--dt-primary, #a78bfa);
}
.tree-val { }
.tree-val--string  { color: oklch(72% 0.17 145); }
.tree-val--number  { color: oklch(74% 0.18 55); }
.tree-val--boolean { color: oklch(72% 0.18 25); }
.tree-val--null    { color: var(--dt-foreground-subtle, #6b7280); }
</style>
