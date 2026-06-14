<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import PanelHeader from "./PanelHeader.vue";
import TabBar from "./TabBar.vue";
import ResizeHandle from "./ResizeHandle.vue";

const { position, size, isOpen, onDragStart, toggle, close } = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();

function onResize(delta: { dw: number; dh: number }): void {
    size.value = {
        width: Math.max(400, size.value.width + delta.dw),
        height: Math.max(300, size.value.height + delta.dh),
    };
}
</script>

<template>
    <!-- Launcher button — always fixed bottom-right, shown when panel is closed -->
    <button
        v-if="!isOpen"
        data-vmd-launcher
        class="fixed z-[9999] bottom-4 right-4 w-10 h-10 rounded-full bg-surface-raised border border-border shadow-lg cursor-pointer flex items-center justify-center text-foreground text-lg hover:bg-surface-hover transition-colors pointer-events-auto"
        title="Open vue-muza devtools"
        @click="toggle"
    >
        ⚡
    </button>

    <!-- Full panel — draggable, fixed positioning -->
    <div
        v-else
        data-vmd-panel
        class="fixed z-[9999] rounded-lg shadow-2xl overflow-hidden font-mono text-sm bg-surface-overlay text-foreground border border-border pointer-events-auto"
        :style="{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
        }"
    >
        <PanelHeader :on-drag-start="onDragStart" :on-close="close" :on-toggle="toggle" />

        <div data-vmd-panel-body class="flex h-[calc(100%-36px)]">
            <TabBar :tabs="registeredTabs" :active-tab-id="activeTabId ?? null" :on-select-tab="setActiveTab" />
            <div class="flex-1 overflow-auto p-3">
                <component :is="activeTab?.component" v-if="activeTab" />
            </div>
        </div>

        <ResizeHandle @resize="onResize" />
    </div>
</template>
