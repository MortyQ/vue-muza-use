<script setup lang="ts">
defineProps<{ label: string; variant?: "success" | "error" | "pending" | "aborted" | "neutral" | "warning" }>();

const variantClass: Record<string, string> = {
    success: "badge--success",
    error:   "badge--error",
    pending: "badge--pending",
    aborted: "badge--aborted",
    neutral: "badge--neutral",
    warning: "badge--warning",
};
</script>

<template>
    <span :class="['badge', variantClass[variant ?? 'neutral']]">{{ label }}</span>
</template>

<style scoped>
.badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-family: ui-monospace, "SF Mono", Consolas, monospace;
    line-height: 1;
    white-space: nowrap;
}

.badge--success { background: var(--dt-vue-green-subtle); color: var(--dt-vue-green); }
.badge--error   { background: var(--dt-danger-subtle);    color: var(--dt-danger); }
.badge--pending { background: var(--dt-warning-subtle);   color: var(--dt-warning); }
.badge--aborted { background: oklch(20% 0.01 250);        color: var(--dt-foreground-muted); }
.badge--neutral { background: oklch(22% 0.015 250);       color: var(--dt-foreground-secondary); }
.badge--warning { background: var(--dt-warning-subtle);   color: var(--dt-warning); }
</style>
