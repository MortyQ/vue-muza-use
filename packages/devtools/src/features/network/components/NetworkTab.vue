<script setup lang="ts">
import { ref, computed, onScopeDispose } from "vue";
import { useNetworkTab } from "../composables/useNetworkTab";
import RequestList from "./RequestList.vue";
import RequestDetail from "./RequestDetail.vue";
import type { RequestStatus } from "../../../shared/types/index";

const {
    urlFilter, statusFilter, instanceFilter, filteredRequests, clearFilters,
    selectedRequest, selectedRequestId,
    viewMode, payloadFormat, responseFormat,
    selectRequest, setViewMode, togglePayloadFormat, toggleResponseFormat,
    instances,
} = useNetworkTab();

const instanceList = computed(() => [...instances.value.values()]);

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
        <div class="toolbar">
            <input
                v-model="urlFilter"
                class="toolbar-input"
                placeholder="Filter URL…"
            />
            <select v-model="instanceFilter" class="toolbar-select">
                <option value="all">All instances</option>
                <option v-for="inst in instanceList" :key="inst.id" :value="inst.id">
                    {{ inst.url ?? inst.id }}
                </option>
            </select>
            <button class="toolbar-btn" @click="clearFilters">Clear</button>
        </div>

        <!-- Filter pills -->
        <div class="filter-bar">
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
                    :view-mode="viewMode"
                    :payload-format="payloadFormat"
                    :response-format="responseFormat"
                    @close="selectRequest(null)"
                    @set-view-mode="setViewMode"
                    @toggle-payload-format="togglePayloadFormat"
                    @toggle-response-format="toggleResponseFormat"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.network-tab { display: flex; flex-direction: column; height: 100%; background: var(--dt-surface-sunken); }
.toolbar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--dt-nav); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; }
.toolbar-input { flex: 1; height: 30px; background: var(--dt-surface); border: 1px solid var(--dt-border); border-radius: 7px; color: var(--dt-foreground); font-size: 12px; padding: 0 10px; outline: none; }
.toolbar-input::placeholder { color: var(--dt-foreground-subtle); }
.toolbar-input:focus { border-color: var(--dt-primary); }
.toolbar-select { height: 30px; background: var(--dt-surface); border: 1px solid var(--dt-border); border-radius: 7px; color: var(--dt-foreground-secondary); font-size: 12px; padding: 0 8px; cursor: pointer; outline: none; }
.toolbar-btn { height: 30px; padding: 0 12px; background: transparent; border: 1px solid var(--dt-border); border-radius: 7px; color: var(--dt-foreground-muted); font-size: 12px; cursor: pointer; }
.toolbar-btn:hover { background: var(--dt-surface-raised); color: var(--dt-foreground); }
.filter-bar { display: flex; align-items: center; gap: 4px; padding: 7px 12px; background: var(--dt-surface-sunken); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; }
.filter-pill { height: 24px; padding: 0 10px; border-radius: 99px; font-size: 11px; font-weight: 500; cursor: pointer; border: 1px solid transparent; background: transparent; color: var(--dt-foreground-muted); text-transform: capitalize; }
.filter-pill:hover { background: var(--dt-surface-raised); color: var(--dt-foreground-secondary); }
.filter-pill--active { background: var(--dt-primary-subtle); color: var(--dt-primary); border-color: var(--dt-primary); }
.filter-count { margin-left: auto; font-size: 11px; color: var(--dt-foreground-subtle); }
.main-split { display: flex; flex: 1; overflow: hidden; }
.list-pane { min-width: 180px; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.detail-pane { flex: 1; min-width: 200px; overflow: hidden; }
.drag-handle { width: 5px; flex-shrink: 0; cursor: col-resize; background: var(--dt-border-subtle); }
.drag-handle:hover { background: var(--dt-primary); }
</style>
