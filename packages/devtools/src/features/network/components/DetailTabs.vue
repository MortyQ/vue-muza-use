<!-- Tab strip for the request detail panel: Split / Payload / Response / Headers. -->
<script setup lang="ts">
type TabId = "split" | "payload" | "response" | "headers";

defineProps<{ activeTab: TabId; hasError?: boolean }>();
defineEmits<{ select: [tab: TabId] }>();

const tabs: ReadonlyArray<{ id: TabId; label: string }> = [
    { id: "split",    label: "Split" },
    { id: "payload",  label: "Payload" },
    { id: "response", label: "Response" },
    { id: "headers",  label: "Headers" },
] as const;
</script>

<template>
    <div class="detail-tabs">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{
                'tab-btn--active': tab.id === activeTab,
                'tab-btn--error': tab.id === 'response' && hasError,
            }"
            @click="$emit('select', tab.id)"
        >
            {{ tab.label }}{{ tab.id === 'response' && hasError ? ' ●' : '' }}
        </button>
    </div>
</template>

<style scoped>
.detail-tabs {
    display: flex;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.tab-btn {
    height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.tab-btn:hover { color: var(--dt-foreground-secondary); }
.tab-btn:active { transform: scale(0.97); }
.tab-btn--active { color: var(--dt-primary); border-bottom-color: var(--dt-primary); }
.tab-btn--error { color: var(--dt-danger); }
.tab-btn--error.tab-btn--active { color: var(--dt-danger); border-bottom-color: var(--dt-danger); }
</style>
