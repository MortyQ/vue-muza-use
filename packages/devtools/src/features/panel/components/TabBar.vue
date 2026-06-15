<!-- Horizontal tab strip with close button. -->
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DevtoolsTab, PanelMode } from "../../../shared/types/index";
import LogoBadge from "../../../shared/components/LogoBadge.vue";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    selectTab: (id: string) => void;
    panelMode: PanelMode;
}>();

defineEmits<{
    close: [];
    "update:panelMode": [PanelMode];
}>();
</script>

<template>
    <div class="tab-bar">
        <div class="logo-slot">
            <LogoBadge />
        </div>
        <div class="tab-list">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                data-vmd-tab
                class="tab-btn"
                :class="tab.id === activeTabId ? 'tab-btn--active' : 'tab-btn--inactive'"
                @click="selectTab(tab.id)"
            >
                <Icon
                    v-if="typeof tab.icon === 'string'"
                    :icon="tab.icon"
                    width="13"
                    height="13"
                />
                <component
                    :is="tab.icon"
                    v-else-if="tab.icon"
                    width="13"
                    height="13"
                />
                <span>{{ tab.label }}</span>
            </button>
        </div>

        <!-- Mode switcher -->
        <div class="mode-switcher">
            <button
                class="mode-btn"
                :class="{ 'mode-btn--active': panelMode === 'bottom' }"
                title="Bottom panel"
                @click="$emit('update:panelMode', 'bottom')"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.35"/>
                    <rect x="1" y="9.5" width="12" height="3.5" rx="1.5" fill="currentColor"/>
                </svg>
            </button>
            <button
                class="mode-btn"
                :class="{ 'mode-btn--active': panelMode === 'side' }"
                title="Side panel"
                @click="$emit('update:panelMode', 'side')"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="7" height="12" rx="1.5" fill="currentColor" opacity="0.35"/>
                    <rect x="9.5" y="1" width="3.5" height="12" rx="1.5" fill="currentColor"/>
                </svg>
            </button>
        </div>

        <div class="mode-divider" />

        <button class="close-btn" title="Close devtools" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.tab-bar {
    display: flex;
    align-items: center;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.logo-slot {
    display: flex;
    align-items: center;
    padding: 0 10px 0 12px;
    flex-shrink: 0;
    opacity: 0.85;
}
.tab-list {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 6px;
    gap: 2px;
}
.tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
}
.tab-btn--active {
    color: var(--dt-vue-green);
    border-bottom-color: var(--dt-vue-green);
}
.tab-btn--inactive {
    color: var(--dt-foreground-muted);
}
.tab-btn--inactive:hover {
    color: var(--dt-foreground-secondary);
    background: var(--dt-surface);
}
.mode-switcher {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    flex-shrink: 0;
}
.mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}
.mode-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
}
.mode-btn--active {
    background: var(--dt-surface-raised);
    color: var(--dt-primary);
}
.mode-btn--active:hover {
    color: var(--dt-primary);
}
.mode-divider {
    width: 1px;
    height: 18px;
    background: var(--dt-border-subtle);
    margin-right: 4px;
    flex-shrink: 0;
}
.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
}
.close-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground);
}
</style>
