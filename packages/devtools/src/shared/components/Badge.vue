<script setup lang="ts">
defineProps<{ label: string; variant?: "success" | "error" | "pending" | "aborted" | "neutral" }>();

const variantClass: Record<string, string> = {
    success: "bg-green-900 text-green-300",
    error:   "bg-red-900 text-red-300",
    pending: "bg-yellow-900 text-yellow-300",
    aborted: "bg-neutral-700 text-neutral-400",
    neutral: "bg-neutral-800 text-neutral-300",
};
</script>

<template>
    <span
        :class="['inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono',
                 variantClass[variant ?? 'neutral']]"
    >{{ label }}</span>
</template>
