<!-- Horizontal tab strip with close button. -->
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DevtoolsTab } from "../../../shared/types/index";
import LogoBadge from "../../../shared/components/LogoBadge.vue";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    selectTab: (id: string) => void;
}>();
defineEmits<{ close: [] }>();
</script>

<template>
    <div class="tab-bar">
        <div class="logo-slot">
            <LogoBadge />
        </div>
        <div class="tab-list">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                data-vmd-tab
                class="tab-btn"
                :class="tab.id === activeTabId ? 'tab-btn--active' : 'tab-btn--inactive'"
                @click="selectTab(tab.id)"
            >
                <Icon
                    v-if="typeof tab.icon === 'string'"
                    :icon="tab.icon"
                    width="13"
                    height="13"
                />
                <component
                    :is="tab.icon"
                    v-else-if="tab.icon"
                    width="13"
                    height="13"
                />
                <span>{{ tab.label }}</span>
            </button>
        </div>
        <button class="close-btn" title="Close devtools" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.tab-bar {
    display: flex;
    align-items: center;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.logo-slot {
    display: flex;
    align-items: center;
    padding: 0 10px 0 12px;
    flex-shrink: 0;
    opacity: 0.85;
}
.tab-list {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 6px;
    gap: 2px;
}
.tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
}
.tab-btn--active {
    color: var(--dt-vue-green);
    border-bottom-color: var(--dt-vue-green);
}
.tab-btn--inactive {
    color: var(--dt-foreground-muted);
}
.tab-btn--inactive:hover {
    color: var(--dt-foreground-secondary);
    background: var(--dt-surface);
}
.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
}
.close-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground);
}
</style>
