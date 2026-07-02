<!-- Top-level tree viewer. Iterates entries and renders one TreeNode per entry. -->
<script setup lang="ts">
import { computed } from "vue";
import TreeNode from "./TreeNode.vue";

const props = defineProps<{ value: unknown }>();

const entries = computed((): Array<[string | number, unknown]> => {
    if (props.value === null || props.value === undefined) return [];
    // undefined array items become null, matching JSON.stringify
    if (Array.isArray(props.value)) return props.value.map((v, i) => [i, v === undefined ? null : v]);
    // safe: null/undefined and arrays handled above; only non-null objects reach here
    // keys with an undefined value are dropped, matching JSON.stringify
    if (typeof props.value === "object") {
        return Object.entries(props.value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    }
    return [];
});
</script>

<template>
    <div class="tree-viewer">
        <TreeNode
            v-for="[key, val] in entries"
            :key="key"
            :node-key="key"
            :value="val"
            :depth="0"
        />
    </div>
</template>

<style scoped>
.tree-viewer { padding: 4px 0; }
</style>
