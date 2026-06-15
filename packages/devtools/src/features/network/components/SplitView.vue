<!-- Two DataPanes side-by-side (bottom mode) or stacked (side mode) with drag-resizable handle. -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onScopeDispose } from "vue";
import DataPane from "./DataPane.vue";
import type { RequestRecord } from "../../../shared/types/index";
import { useFloatingPanel } from "../../panel/composables/useFloatingPanel";
import { loadSplitPayloadWidth, saveSplitPayloadWidth } from "../../../shared/storage/devtoolsStorage";

defineProps<{ request: RequestRecord }>();

const { panelMode } = useFloatingPanel();
const stacked = computed(() => panelMode.value === "side");

const primarySize = ref<number | null>(null);
const splitRef = ref<HTMLElement | null>(null);
let splitDragCleanup: (() => void) | null = null;

// Reset saved size when layout direction changes to avoid wrong-axis values
watch(stacked, () => { primarySize.value = null; });

onMounted(async () => {
    const saved = await loadSplitPayloadWidth();
    if (saved !== undefined) primarySize.value = saved;
});

function startSplitResize(e: MouseEvent): void {
    const container = splitRef.value;
    if (!container) return;

    if (stacked.value) {
        const startY = e.clientY;
        const startH = primarySize.value ?? container.offsetHeight / 2;
        function onMove(ev: MouseEvent): void {
            const maxH = container.offsetHeight - 80 - 5;
            primarySize.value = Math.max(80, Math.min(startH + (ev.clientY - startY), maxH));
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
    } else {
        const startX = e.clientX;
        const startW = primarySize.value ?? container.offsetWidth / 2;
        function onMove(ev: MouseEvent): void {
            const maxW = container.offsetWidth - 120 - 5;
            primarySize.value = Math.max(120, Math.min(startW + (ev.clientX - startX), maxW));
        }
        function onUp(): void {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            splitDragCleanup = null;
            saveSplitPayloadWidth(primarySize.value!);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        splitDragCleanup = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }
    e.preventDefault();
}

onScopeDispose(() => { splitDragCleanup?.(); });
</script>

<template>
    <div ref="splitRef" class="split-view" :class="stacked ? 'split-view--stacked' : 'split-view--row'">
        <!-- Payload pane -->
        <div
            class="split-pane"
            :style="primarySize !== null
                ? (stacked ? { flex: 'none', height: primarySize + 'px' } : { flex: 'none', width: primarySize + 'px' })
                : {}"
        >
            <DataPane title="Payload" :data="request.payload" :truncated="request.truncated" />
        </div>

        <!-- Drag handle -->
        <div
            class="split-handle"
            :class="stacked ? 'split-handle--h' : 'split-handle--v'"
            @mousedown="startSplitResize"
        />

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
.split-view--row { flex-direction: row; }
.split-view--stacked { flex-direction: column; }

.split-pane {
    flex: 1;
    overflow: hidden;
}
.split-view--row .split-pane { min-width: 120px; }
.split-view--stacked .split-pane { min-height: 80px; }

.split-handle {
    flex-shrink: 0;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
}
.split-handle--v { width: 5px; cursor: col-resize; }
.split-handle--h { height: 5px; cursor: row-resize; }
.split-handle:hover { background: var(--dt-primary); }
</style>
