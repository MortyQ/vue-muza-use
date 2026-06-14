<script setup lang="ts">
import type { Ref } from "vue";
import type { DevtoolsTab } from "../../../shared/types/index";

defineProps<{
    tabs: Ref<readonly DevtoolsTab[]>;
    activeTabId: Ref<string | null>;
    onSelectTab: (id: string) => void;
}>();
</script>

<template>
    <nav class="vmd:flex vmd:flex-col vmd:w-10 vmd:border-r vmd:border-neutral-700 vmd:bg-neutral-900">
        <button
            v-for="tab in tabs.value"
            :key="tab.id"
            data-vmd-tab
            :title="tab.label"
            :class="[
                'vmd:flex vmd:items-center vmd:justify-center vmd:h-10 vmd:w-full vmd:text-xs',
                tab.id === activeTabId.value
                    ? 'vmd:text-white vmd:bg-neutral-700'
                    : 'vmd:text-neutral-500 vmd:hover:text-neutral-200',
            ]"
            @click="onSelectTab(tab.id)"
        >
            <component :is="tab.icon ?? '📋'" />
        </button>
    </nav>
</template>
