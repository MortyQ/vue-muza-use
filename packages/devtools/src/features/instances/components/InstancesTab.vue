<script setup lang="ts">
import { useInstancesTab } from "../composables/useInstancesTab";
import InstanceRow from "./InstanceRow.vue";
import InstanceDetail from "./InstanceDetail.vue";

const {
    searchTerm, filteredInstances,
    selectedInstance, instanceRequests,
    selectInstance, clearSelection,
} = useInstancesTab();
</script>

<template>
    <div class="flex h-full">
        <div class="w-1/2 flex flex-col border-r border-neutral-800">
            <input
                v-model="searchTerm"
                placeholder="Search by URL…"
                class="w-full bg-neutral-800 text-xs text-white px-3 py-2 border-b border-neutral-700 outline-none"
            />
            <div class="flex-1 overflow-auto">
                <InstanceRow
                    v-for="inst in filteredInstances"
                    :key="inst.id"
                    :instance="inst"
                    :is-active="selectedInstance?.id === inst.id"
                    @select="selectInstance"
                />
                <div v-if="filteredInstances.length === 0" class="text-xs text-neutral-500 p-4">
                    No active instances.
                </div>
            </div>
        </div>
        <div class="flex-1 overflow-auto">
            <InstanceDetail
                v-if="selectedInstance"
                :instance="selectedInstance"
                :requests="instanceRequests"
                @close="clearSelection"
            />
            <div v-else class="text-xs text-neutral-500 p-4">Select an instance to inspect.</div>
        </div>
    </div>
</template>
