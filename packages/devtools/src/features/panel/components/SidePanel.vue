<!-- Right-side devtools panel with left-edge drag resize. -->
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
import TabBar from "./TabBar.vue";
import MIcon from "../../../shared/components/MIcon.vue";

const { sideWidth, isOpen, panelMode, startResizeSideWidth, switchMode, toggle, close } = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
const { toggleSettings } = useNetworkLayout();
</script>

<template>
    <!-- Launcher pill — shown when panel is closed -->
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

    <!-- Side panel -->
    <Transition name="panel">
        <div
            v-if="isOpen"
            data-vmd-panel
            class="side-panel"
            :style="{ width: `${sideWidth}px` }"
        >
            <!-- Left resize handle -->
            <div class="resize-handle" @mousedown="startResizeSideWidth" />

            <div class="panel-body">
                <!-- Tab bar -->
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

.side-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 99998;
    display: flex;
    flex-direction: row;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 14px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: -8px 0 40px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04);
}

.resize-handle {
    width: 4px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
}
.resize-handle:hover { background: var(--dt-primary); }

.panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

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
    transform: translateX(12px);
    opacity: 0;
}
</style>
