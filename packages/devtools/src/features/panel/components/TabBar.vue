<!-- Horizontal tab strip with drag handle in the logo pill. -->
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DevtoolsTab, PanelMode } from "../../../shared/types/index";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    selectTab: (id: string) => void;
    panelMode: PanelMode;
    startDrag: (e: MouseEvent) => void;
}>();

defineEmits<{
    close: [];
    "update:panelMode": [PanelMode];
    settings: [];
    "resetGeometry": [];
}>();
</script>

<template>
    <div class="tab-bar">
        <!-- Logo pill — doubles as drag handle on hover -->
        <div class="logo-pill" @mousedown.prevent="startDrag">
            <span class="logo-icon">▲▲</span>
            <span class="logo-drag-icon">⠿</span>
            <span class="logo-text">vue-muza</span>
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

        <button class="settings-btn" title="Layout settings" @click="$emit('settings')">
            <Icon icon="lucide:settings-2" width="14" height="14" />
        </button>

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

/* Logo pill — drag handle */
.logo-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px 0 9px;
    margin: 0 6px 0 8px;
    background: var(--dt-primary);
    border-radius: 99px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    user-select: none;
    flex-shrink: 0;
    cursor: default;
    transition: background 150ms ease-out;
}
.logo-pill:hover {
    cursor: grab;
    background: color-mix(in oklch, var(--dt-primary) 85%, white);
}
.logo-pill:active { cursor: grabbing; }

.logo-icon { font-size: 10px; }
.logo-drag-icon { font-size: 14px; display: none; }
.logo-text { font-size: 12px; }

.logo-pill:hover .logo-icon      { display: none; }
.logo-pill:hover .logo-drag-icon { display: inline; }

.tab-list {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 6px;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
}
.tab-list::-webkit-scrollbar { display: none; }

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
    transition: color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
}
.tab-btn:active { transform: scale(0.97); }
.tab-btn--active {
    color: var(--dt-vue-green);
    border-bottom-color: var(--dt-vue-green);
}
.tab-btn--inactive { color: var(--dt-foreground-muted); }
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
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.mode-btn:active { transform: scale(0.97); }
.mode-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
}
.mode-btn--active {
    background: var(--dt-surface-raised);
    color: var(--dt-primary);
}
.mode-btn--active:hover { color: var(--dt-primary); }

.mode-divider {
    width: 1px;
    height: 18px;
    background: var(--dt-border-subtle);
    margin-right: 4px;
    flex-shrink: 0;
}

.settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.settings-btn:active { transform: scale(0.97); }
.settings-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
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
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.close-btn:active { transform: scale(0.97); }
.close-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground);
}
</style>
