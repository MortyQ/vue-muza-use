<script setup lang="ts">
import type { DevtoolsTab } from "../../../shared/types/index";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    onSelectTab: (id: string) => void;
}>();
</script>

<template>
    <nav class="flex flex-col w-10 border-r border-border bg-surface-raised">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            data-vmd-tab
            :title="tab.label"
            :class="[
                'flex items-center justify-center h-10 w-full text-xs',
                tab.id === activeTabId
                    ? 'text-foreground bg-surface-active'
                    : 'text-foreground-muted hover:text-foreground',
            ]"
            @click="onSelectTab(tab.id)"
        >
            <component :is="tab.icon ?? '📋'" />
        </button>
    </nav>
</template>
