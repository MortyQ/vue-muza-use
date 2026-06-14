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
    <div class="vmd:flex vmd:h-full">
        <div class="vmd:w-1/2 vmd:flex vmd:flex-col vmd:border-r vmd:border-neutral-800">
            <input
                v-model="searchTerm"
                placeholder="Search by URL…"
                class="vmd:w-full vmd:bg-neutral-800 vmd:text-xs vmd:text-white vmd:px-3 vmd:py-2 vmd:border-b vmd:border-neutral-700 vmd:outline-none"
            />
            <div class="vmd:flex-1 vmd:overflow-auto">
                <InstanceRow
                    v-for="inst in filteredInstances"
                    :key="inst.id"
                    :instance="inst"
                    :is-active="selectedInstance?.id === inst.id"
                    @select="selectInstance"
                />
                <div v-if="filteredInstances.length === 0" class="vmd:text-xs vmd:text-neutral-500 vmd:p-4">
                    No active instances.
                </div>
            </div>
        </div>
        <div class="vmd:flex-1 vmd:overflow-auto">
            <InstanceDetail
                v-if="selectedInstance"
                :instance="selectedInstance"
                :requests="instanceRequests"
                @close="clearSelection"
            />
            <div v-else class="vmd:text-xs vmd:text-neutral-500 vmd:p-4">Select an instance to inspect.</div>
        </div>
    </div>
</template>
