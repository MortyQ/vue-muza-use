<!-- Full request detail panel: header, tabs, and content view. -->
<script setup lang="ts">
import { ref } from "vue";
import type { RequestRecord } from "../../../shared/types/index";
import DetailHeader from "./DetailHeader.vue";
import DetailTabs from "./DetailTabs.vue";
import SplitView from "./SplitView.vue";
import DataPane from "./DataPane.vue";

defineProps<{ request: RequestRecord }>();
defineEmits<{ close: [] }>();

type TabId = "split" | "payload" | "response" | "headers";
const activeTab = ref<TabId>("split");
</script>

<template>
    <div class="request-detail">
        <DetailHeader :request="request" @close="$emit('close')" />
        <DetailTabs :active-tab="activeTab" @select="activeTab = $event" />

        <div class="detail-content">
            <SplitView v-if="activeTab === 'split'" :request="request" />

            <DataPane
                v-else-if="activeTab === 'payload'"
                title="Payload"
                :data="request.payload"
                :truncated="request.truncated"
            />

            <DataPane
                v-else-if="activeTab === 'response'"
                title="Response"
                :data="request.response"
                :truncated="request.truncated"
            />

            <div v-else-if="activeTab === 'headers'" class="headers-view">
                <div
                    v-for="(val, key) in request.requestHeaders"
                    :key="key"
                    class="header-row"
                >
                    <span class="header-key">{{ key }}</span>
                    <span class="header-val">{{ val }}</span>
                </div>
                <p v-if="!Object.keys(request.requestHeaders ?? {}).length" class="empty-msg">
                    No request headers captured.
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.request-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--dt-surface-sunken);
}
.detail-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.headers-view {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
}
.headers-view::-webkit-scrollbar { width: 4px; }
.headers-view::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.header-row {
    display: flex;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--dt-border-subtle);
}
.header-row:last-child { border-bottom: none; }
.header-key {
    color: oklch(72% 0.17 260);
    width: 38%;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.header-val {
    color: var(--dt-foreground-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}
.empty-msg { color: var(--dt-foreground-subtle); font-size: 12px; }
</style>
