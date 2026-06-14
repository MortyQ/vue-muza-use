<!-- vue-muza logo — two inverted V chevrons (∧∧), two-tone white. -->
<script setup lang="ts">
defineProps<{
    width?: number | string;
    height?: number | string;
}>();
</script>

<template>
    <svg
        :width="width ?? 22"
        :height="height ?? 10"
        viewBox="0 0 80 36"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <!-- Left ∧ outer (62% opacity) -->
        <path d="M0,36 L20,0 L40,36 Z" fill="rgba(255,255,255,0.62)" />
        <!-- Left ∧ inner (full white) -->
        <path d="M8,36 L20,16 L32,36 Z" fill="white" />
        <!-- Right ∧ outer (62% opacity) -->
        <path d="M40,36 L60,0 L80,36 Z" fill="rgba(255,255,255,0.62)" />
        <!-- Right ∧ inner (full white) -->
        <path d="M48,36 L60,16 L72,36 Z" fill="white" />
    </svg>
</template>
