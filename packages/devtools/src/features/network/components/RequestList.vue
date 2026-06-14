<script setup lang="ts">
import { ref, computed } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { RequestRecord, DevtoolsInstanceOptions } from "../../../shared/types/index";
import { useDevtoolsStore } from "../../../shared/composables/useDevtoolsStore";
import RequestRow from "./RequestRow.vue";

const props = defineProps<{
    requests: ReadonlyArray<RequestRecord>;
    activeRequestId: string | null;
}>();
defineEmits<{ (e: "select", id: string): void }>();

const { instances } = useDevtoolsStore();

function getInstanceOptions(instanceId: string | null): DevtoolsInstanceOptions | undefined {
    if (!instanceId) return undefined;
    return instances.value.get(instanceId)?.options;
}

const parentRef = ref<HTMLElement | null>(null);

const rowVirtualizer = useVirtualizer(
    computed(() => ({
        count: props.requests.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 52,
        overscan: 10,
    })),
);
</script>

<template>
    <div ref="parentRef" class="flex-1 overflow-auto" style="background: var(--dt-surface-sunken);">
        <div :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }">
            <div
                v-for="vRow in rowVirtualizer.getVirtualItems()"
                :key="vRow.index"
                :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }"
            >
                <RequestRow
                    :request="requests[vRow.index]"
                    :is-active="requests[vRow.index].id === activeRequestId"
                    :instance-options="getInstanceOptions(requests[vRow.index].instanceId)"
                    @select="$emit('select', $event)"
                />
            </div>
        </div>
    </div>
</template>
