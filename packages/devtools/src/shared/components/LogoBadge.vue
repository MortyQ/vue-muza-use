<!-- Pill badge matching the launcher button — used in the tab bar. -->
<script setup lang="ts">
import MIcon from "./MIcon.vue";
</script>

<template>
    <div class="logo-badge">
        <MIcon :width="20" :height="9" />
        <span>vue-muza</span>
    </div>
</template>

<style scoped>
.logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 26px;
    padding: 0 11px 0 9px;
    background: var(--dt-primary);
    border-radius: 99px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.35);
    user-select: none;
    flex-shrink: 0;
}
</style>
