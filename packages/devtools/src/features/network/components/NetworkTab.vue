<script setup lang="ts">
import { computed } from "vue";
import { useNetworkTab } from "../composables/useNetworkTab";
import RequestList from "./RequestList.vue";
import RequestDetail from "./RequestDetail.vue";

const {
    urlFilter, statusFilter, instanceFilter, filteredRequests, clearFilters,
    selectedRequest, selectedRequestId,
    viewMode, payloadFormat, responseFormat,
    selectRequest, setViewMode, togglePayloadFormat, toggleResponseFormat,
    instances,
} = useNetworkTab();

const instanceList = computed(() => [...instances.value.values()]);
</script>

<template>
    <div class="vmd:flex vmd:flex-col vmd:h-full">
        <!-- Filter bar -->
        <div class="vmd:flex vmd:items-center vmd:gap-2 vmd:px-3 vmd:py-2 vmd:border-b vmd:border-neutral-700 vmd:bg-neutral-900">
            <input
                v-model="urlFilter"
                placeholder="Filter URL…"
                class="vmd:flex-1 vmd:bg-neutral-800 vmd:text-xs vmd:text-white vmd:px-2 vmd:py-1 vmd:rounded vmd:outline-none"
            />
            <select v-model="statusFilter" class="vmd:bg-neutral-800 vmd:text-xs vmd:text-white vmd:px-2 vmd:py-1 vmd:rounded">
                <option value="all">All</option>
                <option v-for="s in ['pending','success','error','aborted']" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="instanceFilter" class="vmd:bg-neutral-800 vmd:text-xs vmd:text-white vmd:px-2 vmd:py-1 vmd:rounded">
                <option value="all">All instances</option>
                <option v-for="inst in instanceList" :key="inst.id" :value="inst.id">{{ inst.url ?? inst.id }}</option>
            </select>
            <button class="vmd:text-xs vmd:text-neutral-400 vmd:hover:text-white" @click="clearFilters">Clear</button>
        </div>

        <!-- List + Detail split -->
        <div class="vmd:flex vmd:flex-1 vmd:overflow-hidden">
            <div :class="selectedRequest ? 'vmd:w-2/5' : 'vmd:w-full'" class="vmd:flex vmd:flex-col vmd:border-r vmd:border-neutral-800">
                <RequestList
                    :requests="filteredRequests"
                    :active-request-id="selectedRequestId"
                    @select="selectRequest"
                />
                <div v-if="filteredRequests.length === 0" class="vmd:text-xs vmd:text-neutral-500 vmd:p-4">No requests.</div>
            </div>
            <div v-if="selectedRequest" class="vmd:flex-1 vmd:overflow-hidden">
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
