<!-- Request detail header: status chip + method + URL + meta + close. -->
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { RequestRecord } from "../../../shared/types/index";

defineProps<{ request: RequestRecord }>();
defineEmits<{ close: [] }>();

function statusClass(code: number | null): string {
    if (!code) return "s-pending";
    if (code < 300) return "s-2xx";
    if (code < 400) return "s-3xx";
    if (code < 500) return "s-4xx";
    return "s-5xx";
}
</script>

<template>
    <div class="detail-header">
        <span class="status-chip" :class="statusClass(request.statusCode)">
            {{ request.statusCode ?? "···" }}
        </span>
        <span class="req-method">{{ request.method }}</span>
        <span class="req-url" :title="request.url">{{ request.url }}</span>
        <div class="req-meta">
            <span v-if="request.duration !== null">{{ request.duration }}ms</span>
            <span>{{ new Date(request.startedAt).toLocaleTimeString() }}</span>
        </div>
        <button class="close-btn" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.status-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    flex-shrink: 0;
}
.s-2xx { background: var(--dt-success-subtle); color: var(--dt-success); }
.s-3xx { background: var(--dt-info-subtle);    color: var(--dt-info); }
.s-4xx { background: var(--dt-warning-subtle); color: var(--dt-warning); }
.s-5xx { background: var(--dt-danger-subtle);  color: var(--dt-danger); }
.s-pending { background: var(--dt-surface-raised); color: var(--dt-foreground-subtle); }
.req-method {
    font-size: 12px;
    font-weight: 600;
    color: var(--dt-foreground-secondary);
    flex-shrink: 0;
}
.req-url {
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
.req-meta {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--dt-foreground-muted);
}
.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
}
.close-btn:hover { background: var(--dt-surface-raised); color: var(--dt-foreground); }
</style>
