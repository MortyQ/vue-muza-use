<script setup lang="ts">
import { ref, computed, onMounted, onScopeDispose } from "vue";
import { useNetworkTab } from "../composables/useNetworkTab";
import { useNetworkLayout } from "../composables/useNetworkLayout";
import { clearRequests } from "../../../shared/store/devtoolsStore";
import { loadListWidth, saveListWidth } from "../../../shared/storage/devtoolsStorage";
import RequestList from "./RequestList.vue";
import RequestDetail from "./RequestDetail.vue";
import SelectInput from "../../../shared/components/SelectInput.vue";
import type { SelectOption } from "../../../shared/components/SelectInput.vue";
import type { RequestStatus, DevtoolsInstanceOptions } from "../../../shared/types/index";

const {
    urlFilter, statusFilter, instanceFilter, filteredRequests, clearFilters,
    selectedRequest, selectedRequestId,
    selectRequest,
    instances,
} = useNetworkTab();

const { toolbarVisible, filterVisible, settingsOpen, toggleToolbar, toggleFilter, closeSettings } = useNetworkLayout();

const instanceOptions = computed<SelectOption[]>(() => [
    { value: "all", label: "All instances" },
    ...[...instances.value.values()].map((inst) => ({
        value: inst.id,
        label: inst.url ?? inst.id,
    })),
]);
const selectedInstanceOptions = computed<DevtoolsInstanceOptions | undefined>(() =>
    selectedRequest.value?.instanceId
        ? instances.value.get(selectedRequest.value.instanceId)?.options
        : undefined,
);

const STATUS_PILLS: Array<{ value: RequestStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "success", label: "Success" },
    { value: "error", label: "Error" },
    { value: "pending", label: "Pending" },
    { value: "aborted", label: "Aborted" },
];

// Drag-resize state
const listWidth = ref(320);
const MIN_LIST_WIDTH = 180;

onMounted(async () => {
    const saved = await loadListWidth();
    if (saved !== undefined) listWidth.value = saved;
});
const splitRef = ref<HTMLElement | null>(null);
let dragCleanup: (() => void) | null = null;

function startListResize(e: MouseEvent): void {
    const startX = e.clientX;
    const startW = listWidth.value;

    function onMove(ev: MouseEvent): void {
        const maxW = splitRef.value
            ? splitRef.value.offsetWidth * 0.7
            : 800;
        listWidth.value = Math.max(MIN_LIST_WIDTH, Math.min(startW + (ev.clientX - startX), maxW));
    }
    function onUp(): void {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        dragCleanup = null;
        saveListWidth(listWidth.value);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    dragCleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    };
    e.preventDefault();
}

onScopeDispose(() => { dragCleanup?.(); });
</script>

<template>
    <div class="network-tab">
        <!-- Toolbar -->
        <div v-show="toolbarVisible" class="toolbar">
            <input
                v-model="urlFilter"
                class="toolbar-input"
                placeholder="Filter URL…"
            />
            <SelectInput v-model="instanceFilter" :options="instanceOptions" />
            <button class="toolbar-btn" @click="clearFilters">Reset filters</button>
            <button class="toolbar-btn toolbar-btn--danger" @click="clearRequests">Clear log</button>
        </div>

        <!-- Filter pills -->
        <div v-show="filterVisible" class="filter-bar">
            <button
                v-for="pill in STATUS_PILLS"
                :key="pill.value"
                class="filter-pill"
                :class="{ 'filter-pill--active': statusFilter === pill.value }"
                @click="statusFilter = pill.value"
            >
                {{ pill.label }}
            </button>
            <span class="filter-count">{{ filteredRequests.length }} request{{ filteredRequests.length === 1 ? '' : 's' }}</span>
        </div>

        <!-- Backdrop — closes menu when clicking outside -->
        <Teleport to="body">
            <div
                v-if="settingsOpen"
                style="position:fixed;inset:0;z-index:99;"
                @click="closeSettings"
            />
        </Teleport>

        <!-- Settings menu -->
        <Transition name="settings-menu">
        <div v-if="settingsOpen" class="settings-menu" @keydown.escape="closeSettings">
            <button class="settings-item" @click="toggleToolbar">
                <span class="settings-check" :class="{ 'settings-check--on': toolbarVisible }">
                    <svg v-if="toolbarVisible" width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </span>
                Toolbar
            </button>
            <button class="settings-item" @click="toggleFilter">
                <span class="settings-check" :class="{ 'settings-check--on': filterVisible }">
                    <svg v-if="filterVisible" width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </span>
                Filter bar
            </button>
        </div>
        </Transition>

        <!-- Main split: list + detail -->
        <div ref="splitRef" class="main-split">
            <div
                class="list-pane"
                :style="selectedRequest ? { width: `${listWidth}px` } : { flex: '1' }"
            >
                <RequestList
                    :requests="filteredRequests"
                    :active-request-id="selectedRequestId"
                    @select="selectRequest"
                />
                <div
                    v-if="filteredRequests.length === 0"
                    style="font-size: 12px; color: var(--dt-foreground-subtle); padding: 16px;"
                >
                    No requests.
                </div>
            </div>

            <div
                v-if="selectedRequest"
                class="drag-handle"
                @mousedown="startListResize"
            />

            <div v-if="selectedRequest" class="detail-pane">
                <RequestDetail
                    :request="selectedRequest"
                    :instance-options="selectedInstanceOptions"
                    @close="selectRequest(null)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.network-tab { display: flex; flex-direction: column; height: 100%; background: var(--dt-background); position: relative; }
.toolbar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--dt-surface); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
.toolbar::-webkit-scrollbar { display: none; }
.toolbar-input { flex: 1; height: 30px; background: var(--dt-surface); border: 1px solid var(--dt-border); border-radius: 7px; color: var(--dt-foreground); font-size: 12px; padding: 0 10px; outline: none; }
.toolbar-input::placeholder { color: var(--dt-foreground-subtle); }
.toolbar-input:focus { border-color: var(--dt-primary); }
.toolbar-btn { height: 30px; padding: 0 12px; background: transparent; border: 1px solid var(--dt-border); border-radius: 7px; color: var(--dt-foreground-muted); font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out; }
.toolbar-btn:active { transform: scale(0.97); }
.toolbar-btn:hover { background: var(--dt-surface-raised); color: var(--dt-foreground); }
.toolbar-btn--danger:hover { background: oklch(20% 0.04 15); color: oklch(70% 0.18 15); border-color: oklch(35% 0.08 15); }
.filter-bar { display: flex; align-items: center; gap: 4px; padding: 7px 12px; background: var(--dt-surface); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
.filter-bar::-webkit-scrollbar { display: none; }
.filter-pill { height: 24px; padding: 0 10px; border-radius: 99px; font-size: 11px; font-weight: 500; cursor: pointer; border: 1px solid transparent; background: transparent; color: var(--dt-foreground-muted); text-transform: capitalize; transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out; }
.filter-pill:active { transform: scale(0.97); }
.filter-pill:hover { background: var(--dt-surface-raised); color: var(--dt-foreground-secondary); }
.filter-pill--active { background: var(--dt-primary-subtle); color: var(--dt-primary); border-color: var(--dt-primary); }
.filter-count { margin-left: auto; font-size: 11px; color: var(--dt-foreground-subtle); }
.main-split { display: flex; flex: 1; overflow: hidden; }
.list-pane { min-width: 180px; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.detail-pane { flex: 1; min-width: 200px; overflow: hidden; }
.drag-handle { width: 5px; flex-shrink: 0; cursor: col-resize; background: var(--dt-border-subtle); transition: background 150ms ease-out; }
.drag-handle:hover { background: var(--dt-primary); }
.settings-menu {
    position: absolute;
    right: 8px;
    top: 0;
    z-index: 100;
    background: var(--dt-nav);
    border: 1px solid var(--dt-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px oklch(0% 0 0 / 0.5);
    min-width: 160px;
    transform-origin: top right;
}
.settings-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--dt-foreground);
    font-size: 12px;
    cursor: pointer;
    border-radius: 5px;
    text-align: left;
    transition: background 120ms ease-out, transform 120ms ease-out;
}
.settings-item:active { transform: scale(0.97); }
.settings-item:hover { background: var(--dt-surface-raised); }
.settings-check {
    width: 14px;
    height: 14px;
    border: 1px solid var(--dt-border-strong);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
}
.settings-check--on {
    background: var(--dt-primary);
    border-color: var(--dt-primary);
}
.settings-menu-enter-active {
    transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease-out;
}
.settings-menu-leave-active {
    transition: transform 100ms ease-in, opacity 100ms ease-in;
}
.settings-menu-enter-from,
.settings-menu-leave-to {
    transform: scale(0.95) translateY(-4px);
    opacity: 0;
}
</style>
