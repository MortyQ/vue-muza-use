<!-- Bottom-drawer devtools panel with launcher pill. -->
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
import TabBar from "./TabBar.vue";
import MIcon from "../../../shared/components/MIcon.vue";

const { height, isOpen, panelMode, startResizeHeight, switchMode, toggle, close } = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
const { toggleSettings } = useNetworkLayout();
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
    <Transition name="panel">
        <div
            v-if="isOpen"
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
                :select-tab="setActiveTab"
                :panel-mode="panelMode"
                @close="close"
                @update:panel-mode="switchMode"
                @settings="toggleSettings"
            />

            <!-- Active tab content -->
            <div class="panel-content">
                <component :is="activeTab?.component" v-if="activeTab" />
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.launcher-pill {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
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
    transition: transform 150ms ease-out, box-shadow 150ms ease-out;
    pointer-events: auto;
}
.launcher-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(65% 0.25 280 / 0.5);
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}

.devtools-panel {
    position: fixed;
    bottom: 8px;
    left: 12px;
    right: 12px;
    z-index: 99998;
    display: flex;
    flex-direction: column;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 12px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 -4px 32px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04);
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

.panel-enter-active {
    transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out;
}
.panel-leave-active {
    transition: transform 160ms ease-in, opacity 160ms ease-in;
}
.panel-enter-from,
.panel-leave-to {
    transform: translateY(12px);
    opacity: 0;
}
</style>
