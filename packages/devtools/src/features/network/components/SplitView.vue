<!-- Two DataPanes side-by-side with drag-resizable handle. -->
<script setup lang="ts">
import { ref, onScopeDispose } from "vue";
import DataPane from "./DataPane.vue";
import type { RequestRecord } from "../../../shared/types/index";

defineProps<{ request: RequestRecord }>();

const leftWidth = ref<number | null>(null);
const splitRef = ref<HTMLElement | null>(null);
let splitDragCleanup: (() => void) | null = null;

function startSplitResize(e: MouseEvent): void {
    const container = splitRef.value;
    if (!container) return;

    const startX = e.clientX;
    const startW = leftWidth.value ?? container.offsetWidth / 2;

    function onMove(ev: MouseEvent): void {
        const maxW = container.offsetWidth - 120 - 5;
        leftWidth.value = Math.max(120, Math.min(startW + (ev.clientX - startX), maxW));
    }
    function onUp(): void {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        splitDragCleanup = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    splitDragCleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    };
    e.preventDefault();
}

onScopeDispose(() => { splitDragCleanup?.(); });
</script>

<template>
    <div ref="splitRef" class="split-view">
        <!-- Payload pane -->
        <div
            class="split-pane"
            :style="leftWidth !== null ? { flex: 'none', width: leftWidth + 'px' } : {}"
        >
            <DataPane title="Payload" :data="request.payload" :truncated="request.truncated" />
        </div>

        <!-- Drag handle -->
        <div class="split-handle" @mousedown="startSplitResize" />

        <!-- Response pane -->
        <div class="split-pane">
            <DataPane title="Response" :data="request.response" :truncated="request.truncated" />
        </div>
    </div>
</template>

<style scoped>
.split-view {
    display: flex;
    height: 100%;
    overflow: hidden;
}
.split-pane {
    flex: 1;
    min-width: 120px;
    overflow: hidden;
}
.split-handle {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
}
.split-handle:hover { background: var(--dt-primary); }
</style>
