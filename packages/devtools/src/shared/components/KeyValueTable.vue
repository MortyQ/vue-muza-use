<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: unknown }>();

interface KvRow { key: string; value: string; type: string }

const rows = computed((): KvRow[] => {
    if (!props.value || typeof props.value !== "object") return [];
    return Object.entries(props.value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        value: String(v),
        type: typeof v,
    }));
});

const typeClass: Record<string, string> = {
    string:  "text-green-400",
    number:  "text-blue-400",
    boolean: "text-yellow-400",
    object:  "text-neutral-400",
};
</script>

<template>
    <table class="w-full text-xs">
        <tbody>
            <tr v-for="row in rows" :key="row.key" class="border-b border-neutral-800">
                <td class="py-1 pr-3 text-purple-400 align-top whitespace-nowrap">{{ row.key }}</td>
                <td :class="['py-1 break-all', typeClass[row.type] ?? 'text-neutral-300']">{{ row.value }}</td>
            </tr>
        </tbody>
    </table>
</template>
