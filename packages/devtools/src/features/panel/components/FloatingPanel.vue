<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import TabBar from "./TabBar.vue";
import MIcon from "../../../shared/components/MIcon.vue";

const { height, isOpen, startResizeHeight, toggle, close } = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
</script>

<template>
    <!-- Launcher pill — fixed bottom-right, shown when panel is closed -->
    <button
        v-if="!isOpen"
        data-vmd-launcher
        class="launcher-pill"
        title="Open vue-muza devtools"
        @click="toggle"
    >
        <MIcon :width="22" :height="10" />
        <span>vue-muza</span>
    </button>

    <!-- Bottom drawer panel -->
    <div
        v-else
        data-vmd-panel
        class="devtools-panel"
        :style="{ height: `${height}px` }"
    >
        <!-- Top resize handle (drag up/down to resize) -->
        <div class="resize-handle" @mousedown="startResizeHeight" />

        <!-- Horizontal tab bar -->
        <TabBar
            :tabs="registeredTabs"
            :active-tab-id="activeTabId ?? null"
            :on-select-tab="setActiveTab"
            @close="close"
        />

        <!-- Active tab content -->
        <div class="panel-content">
            <component :is="activeTab?.component" v-if="activeTab" />
        </div>
    </div>
</template>

<style scoped>
.launcher-pill {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    background: var(--dt-primary);
    border-radius: 99px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px oklch(65% 0.25 280 / 0.35);
    transition: transform 0.15s, box-shadow 0.15s;
    pointer-events: auto;
}
.launcher-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(65% 0.25 280 / 0.5);
}

.devtools-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    background: var(--dt-surface-sunken);
    color: var(--dt-foreground);
    border-top: 1px solid var(--dt-border);
    border-radius: 12px 12px 0 0;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.resize-handle {
    height: 4px;
    flex-shrink: 0;
    cursor: row-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
}
.resize-handle:hover { background: var(--dt-primary); }

.panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
</style>
