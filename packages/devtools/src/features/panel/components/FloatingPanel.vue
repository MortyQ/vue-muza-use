<!-- Bottom devtools panel with free-floating drag and 4-edge resize. -->
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
import TabBar from "./TabBar.vue";

const {
    geometry, isGeometryReady, isOpen, panelMode,
    startDrag, startResizeTop, startResizeBottom, startResizeLeft, startResizeRight,
    switchMode, toggle, close, resetGeometry,
} = useFloatingPanel();
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
        <span class="launcher-icon" aria-hidden="true">▲▲</span>
        <span class="launcher-label">vue-muza</span>
    </button>

    <!-- Bottom panel -->
    <Transition name="panel">
        <div
            v-if="isOpen"
            data-vmd-panel
            class="devtools-panel"
            :style="{
                left: `${geometry.x}px`,
                top: `${geometry.y}px`,
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
                opacity: isGeometryReady ? 1 : 0,
            }"
        >
            <!-- Resize handles -->
            <div class="resize-handle resize-top"    @mousedown.prevent="startResizeTop" />
            <div class="resize-handle resize-bottom" @mousedown.prevent="startResizeBottom" />
            <div class="resize-handle resize-left"   @mousedown.prevent="startResizeLeft" />
            <div class="resize-handle resize-right"  @mousedown.prevent="startResizeRight" />

            <TabBar
                :tabs="registeredTabs"
                :active-tab-id="activeTabId ?? null"
                :select-tab="setActiveTab"
                :panel-mode="panelMode"
                :start-drag="startDrag"
                @close="close"
                @update:panel-mode="switchMode"
                @settings="toggleSettings"
                @reset-geometry="resetGeometry"
            />

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
    right: 8px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    overflow: hidden;
    justify-content: flex-start;
    background: var(--dt-primary);
    border-radius: 99px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 10px oklch(65% 0.25 280 / 0.35);
    transition: width 240ms cubic-bezier(.4,0,.2,1), transform 200ms ease, box-shadow 200ms ease;
    pointer-events: auto;
}
.launcher-pill:hover {
    width: 136px;
    transform: translateY(-3px);
    box-shadow: 0 6px 20px oklch(65% 0.25 280 / 0.5);
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
.launcher-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
}
.launcher-label {
    opacity: 0;
    white-space: nowrap;
    padding-left: 6px;
    padding-right: 12px;
    will-change: opacity;
    transition: opacity 160ms ease 80ms;
}
.launcher-pill:hover .launcher-label {
    opacity: 1;
}

.devtools-panel {
    position: fixed;
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
    position: absolute;
    background: transparent;
    z-index: 1;
    transition: background 150ms ease-out;
}
.resize-handle:hover { background: var(--dt-primary); }

.resize-top {
    top: 0;
    left: 12px;
    right: 12px;
    height: 4px;
    cursor: row-resize;
}
.resize-left {
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    cursor: col-resize;
}
.resize-bottom {
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 4px;
    cursor: row-resize;
}
.resize-right {
    right: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    cursor: col-resize;
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
    transform: translateY(12px);
    opacity: 0;
}
</style>
