<!-- Flat key-value table for JSON objects. -->
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: unknown }>();

type ValueType = "string" | "number" | "boolean" | "null" | "object" | "array";

interface KvRow {
    key: string;
    displayValue: string;
    valueType: ValueType;
}

function toRows(obj: Record<string, unknown>): KvRow[] {
    return Object.entries(obj).map(([key, v]) => {
        if (v === null)
            return { key, displayValue: "null", valueType: "null" };
        if (typeof v === "boolean")
            return { key, displayValue: String(v), valueType: "boolean" };
        if (typeof v === "number")
            return { key, displayValue: String(v), valueType: "number" };
        if (typeof v === "string")
            return { key, displayValue: `"${v}"`, valueType: "string" };
        if (Array.isArray(v))
            return { key, displayValue: `Array [${v.length}]`, valueType: "array" };
        if (typeof v === "object")
            return { key, displayValue: `Object {${Object.keys(v as object).length}}`, valueType: "object" };
        return { key, displayValue: String(v), valueType: "string" };
    });
}

const rows = computed((): KvRow[] => {
    if (!props.value || typeof props.value !== "object") return [];
    return toRows(props.value as Record<string, unknown>);
});
</script>

<template>
    <table class="kv-table">
        <tbody>
            <tr v-for="row in rows" :key="row.key" class="kv-row">
                <td class="kv-key">{{ row.key }}</td>
                <td class="kv-value" :class="`kv-${row.valueType}`">
                    <span
                        v-if="row.valueType === 'object' || row.valueType === 'array'"
                        class="kv-nested"
                    >{{ row.displayValue }} ▾</span>
                    <template v-else>{{ row.displayValue }}</template>
                </td>
            </tr>
        </tbody>
    </table>
</template>

<style scoped>
.kv-table {
    width: 100%;
    border-collapse: collapse;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
}
.kv-row { border-bottom: 1px solid var(--dt-border-subtle); }
.kv-row:last-child { border-bottom: none; }
.kv-row:hover td { background: var(--dt-surface); }
.kv-key {
    padding: 6px 10px;
    color: var(--dt-foreground-secondary);
    font-weight: 500;
    white-space: nowrap;
    width: 38%;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
}
.kv-value {
    padding: 6px 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
}
.kv-string  { color: oklch(72% 0.17 145); }
.kv-number  { color: oklch(74% 0.18 55); }
.kv-boolean { color: oklch(72% 0.18 25); }
.kv-null    { color: var(--dt-foreground-subtle); }
.kv-nested {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-muted);
    cursor: pointer;
    font-size: 11px;
}
.kv-nested:hover { background: var(--dt-primary-subtle); color: var(--dt-primary); }
</style>
