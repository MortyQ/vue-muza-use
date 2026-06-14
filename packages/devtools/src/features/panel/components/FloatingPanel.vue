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
    <div
        data-vmd-panel
        class="vmd:fixed vmd:z-[9999] vmd:rounded-lg vmd:shadow-2xl vmd:overflow-hidden vmd:font-mono vmd:text-sm vmd:bg-neutral-900 vmd:text-white vmd:border vmd:border-neutral-700"
        :style="{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
        }"
    >
        <PanelHeader :on-drag-start="onDragStart" :on-close="close" :on-toggle="toggle" />

        <div v-if="isOpen" data-vmd-panel-body class="vmd:flex vmd:h-[calc(100%-36px)]">
            <TabBar :tabs="registeredTabs" :active-tab-id="activeTabId ?? null" :on-select-tab="setActiveTab" />
            <div class="vmd:flex-1 vmd:overflow-auto vmd:p-3">
                <component :is="activeTab?.component" v-if="activeTab" />
            </div>
        </div>

        <ResizeHandle @resize="onResize" />
    </div>
</template>
