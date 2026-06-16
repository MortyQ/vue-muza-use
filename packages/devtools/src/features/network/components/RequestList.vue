<script setup lang="ts">
import { ref, computed } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { RequestRecord } from "../../../shared/types/index";
import RequestRow from "./RequestRow.vue";

const props = defineProps<{
    requests: ReadonlyArray<RequestRecord>;
    activeRequestId: string | null;
}>();
defineEmits<{ (e: "select", id: string): void }>();

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
    <div ref="parentRef" style="flex: 1; overflow: auto; background: var(--dt-background);">
        <div :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }">
            <div
                v-for="vRow in rowVirtualizer.getVirtualItems()"
                :key="vRow.index"
                :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }"
            >
                <RequestRow
                    :request="requests[vRow.index]"
                    :is-active="requests[vRow.index].id === activeRequestId"
                    :instance-options="requests[vRow.index].instanceOptions"
                    @select="$emit('select', $event)"
                />
            </div>
        </div>
    </div>
</template>
