<!-- Full request detail panel: header, tabs, and content view. -->
<script setup lang="ts">
import { ref } from "vue";
import type { RequestRecord, DevtoolsInstanceOptions } from "../../../shared/types/index";
import DetailHeader from "./DetailHeader.vue";
import DetailTabs from "./DetailTabs.vue";
import SplitView from "./SplitView.vue";
import DataPane from "./DataPane.vue";
import PayloadPane from "./PayloadPane.vue";
import CacheInfoBar from "./CacheInfoBar.vue";

defineProps<{ request: RequestRecord; instanceOptions?: DevtoolsInstanceOptions }>();
defineEmits<{ close: [] }>();

type TabId = "split" | "payload" | "response" | "headers";
const activeTab = ref<TabId>("split");
</script>

<template>
    <div class="request-detail">
        <DetailHeader :request="request" :instance-options="instanceOptions" @close="$emit('close')" />
        <CacheInfoBar
            v-if="instanceOptions?.cache"
            :request="request"
            :cache="instanceOptions.cache"
        />
        <DetailTabs :active-tab="activeTab" :has-error="!!request.error" @select="activeTab = $event" />

        <div class="detail-content">
            <SplitView v-show="activeTab === 'split'" :request="request" />

            <PayloadPane
                v-show="activeTab === 'payload'"
                :query-params="request.queryParams"
                :payload="request.payload"
                :truncated="request.truncated"
            />

            <DataPane
                v-show="activeTab === 'response'"
                title="Response"
                :data="request.response"
                :truncated="request.truncated"
                :error="request.error"
            />

            <!-- Headers are captured at request completion (post-interceptor),
                 so pending records show both empty states until the request ends. -->
            <div v-show="activeTab === 'headers'" class="headers-view">
                <div class="section-label"><span>Request Headers</span></div>
                <div class="headers-section" data-test="request-headers">
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
                <div class="section-label"><span>Response Headers</span></div>
                <div class="headers-section" data-test="response-headers">
                    <div
                        v-for="(val, key) in request.responseHeaders"
                        :key="key"
                        class="header-row"
                    >
                        <span class="header-key">{{ key }}</span>
                        <span class="header-val">{{ val }}</span>
                    </div>
                    <p v-if="!Object.keys(request.responseHeaders ?? {}).length" class="empty-msg">
                        No response headers captured.
                    </p>
                </div>
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
    overflow-y: auto;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
}
.headers-section {
    padding: 6px 12px;
}
.section-label {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dt-foreground-subtle);
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
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
