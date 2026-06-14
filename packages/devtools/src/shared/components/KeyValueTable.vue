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
    string:  "vmd:text-green-400",
    number:  "vmd:text-blue-400",
    boolean: "vmd:text-yellow-400",
    object:  "vmd:text-neutral-400",
};
</script>

<template>
    <table class="vmd:w-full vmd:text-xs">
        <tbody>
            <tr v-for="row in rows" :key="row.key" class="vmd:border-b vmd:border-neutral-800">
                <td class="vmd:py-1 vmd:pr-3 vmd:text-purple-400 vmd:align-top vmd:whitespace-nowrap">{{ row.key }}</td>
                <td :class="['vmd:py-1 vmd:break-all', typeClass[row.type] ?? 'vmd:text-neutral-300']">{{ row.value }}</td>
            </tr>
        </tbody>
    </table>
</template>
