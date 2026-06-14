<script setup lang="ts">
defineProps<{ label: string; variant?: "success" | "error" | "pending" | "aborted" | "neutral" }>();

const variantClass: Record<string, string> = {
    success: "vmd:bg-green-900 vmd:text-green-300",
    error:   "vmd:bg-red-900 vmd:text-red-300",
    pending: "vmd:bg-yellow-900 vmd:text-yellow-300",
    aborted: "vmd:bg-neutral-700 vmd:text-neutral-400",
    neutral: "vmd:bg-neutral-800 vmd:text-neutral-300",
};
</script>

<template>
    <span
        :class="['vmd:inline-flex vmd:items-center vmd:px-1.5 vmd:py-0.5 vmd:rounded vmd:text-xs vmd:font-mono',
                 variantClass[variant ?? 'neutral']]"
    >{{ label }}</span>
</template>
