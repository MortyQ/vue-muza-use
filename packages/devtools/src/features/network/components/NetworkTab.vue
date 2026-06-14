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
    <div class="flex flex-col h-full">
        <!-- Filter bar -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-neutral-700 bg-neutral-900">
            <input
                v-model="urlFilter"
                placeholder="Filter URL…"
                class="flex-1 bg-neutral-800 text-xs text-white px-2 py-1 rounded outline-none"
            />
            <select v-model="statusFilter" class="bg-neutral-800 text-xs text-white px-2 py-1 rounded">
                <option value="all">All</option>
                <option v-for="s in ['pending','success','error','aborted']" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="instanceFilter" class="bg-neutral-800 text-xs text-white px-2 py-1 rounded">
                <option value="all">All instances</option>
                <option v-for="inst in instanceList" :key="inst.id" :value="inst.id">{{ inst.url ?? inst.id }}</option>
            </select>
            <button class="text-xs text-neutral-400 hover:text-white" @click="clearFilters">Clear</button>
        </div>

        <!-- List + Detail split -->
        <div class="flex flex-1 overflow-hidden">
            <div :class="selectedRequest ? 'w-2/5' : 'w-full'" class="flex flex-col border-r border-neutral-800">
                <RequestList
                    :requests="filteredRequests"
                    :active-request-id="selectedRequestId"
                    @select="selectRequest"
                />
                <div v-if="filteredRequests.length === 0" class="text-xs text-neutral-500 p-4">No requests.</div>
            </div>
            <div v-if="selectedRequest" class="flex-1 overflow-hidden">
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
