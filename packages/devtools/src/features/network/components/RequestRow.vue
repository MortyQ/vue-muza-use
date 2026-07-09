<script setup lang="ts">
import type { RequestRecord, DevtoolsInstanceOptions } from "../../../shared/types/index";
import StatusBadge from "./StatusBadge.vue";
import Badge from "../../../shared/components/Badge.vue";
import FeatureBadges from "../../../shared/components/FeatureBadges.vue";

defineProps<{
    request: RequestRecord;
    isActive: boolean;
    instanceOptions?: DevtoolsInstanceOptions;
}>();
defineEmits<{ select: [id: string] }>();

function formatDuration(ms: number | null): string {
    if (ms === null) return "…";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
}
</script>

<template>
    <div
        data-vmd-request-row
        class="request-row"
        :class="{ 'request-row--active': isActive }"
        @click="$emit('select', request.id)"
    >
        <div class="accent-bar" :class="`accent-bar--${request.status}`" />

        <div class="row-body">
            <!-- Top: method + url + feature badges -->
            <div class="row-top">
                <span class="method-badge" :class="`method-${request.method.toLowerCase()}`">
                    {{ request.method }}
                </span>
                <span class="row-url">{{ request.url }}</span>
                <FeatureBadges v-if="instanceOptions" :options="instanceOptions" />
            </div>
            <!-- Bottom: status + duration + time -->
            <div class="row-meta">
                <StatusBadge :status="request.status" :status-code="request.statusCode" />
                <Badge
                    v-if="request.authRetried"
                    label="401 → refreshed"
                    variant="warning"
                    data-test="auth-retried"
                />
                <span class="meta-duration">{{ formatDuration(request.duration) }}</span>
                <span class="meta-time">{{ formatTime(request.startedAt) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.request-row {
    display: flex;
    align-items: stretch;
    cursor: pointer;
    border-bottom: 1px solid var(--dt-border-subtle);
    transition: background 0.12s;
    position: relative;
    height: 52px;
    overflow: hidden;
}
.request-row:hover { background: var(--dt-surface); }
.request-row--active { background: var(--dt-surface-raised); }
.request-row--active::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 2px;
    background: var(--dt-primary);
}

.accent-bar { width: 3px; flex-shrink: 0; }
.accent-bar--success { background: var(--dt-vue-green); }
.accent-bar--error   { background: var(--dt-danger); }
.accent-bar--pending { background: var(--dt-foreground-subtle); }
.accent-bar--aborted { background: var(--dt-foreground-subtle); }

.row-body { flex: 1; min-width: 0; padding: 9px 12px; }

.row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
    min-width: 0;
}
.row-url {
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}
.row-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
}
.meta-duration { color: var(--dt-foreground-muted); }
.meta-time { color: var(--dt-foreground-subtle); margin-left: auto; }

/* Method badges */
.method-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
}
.method-get    { background: var(--dt-info-subtle);    color: var(--dt-info); }
.method-post   { background: var(--dt-success-subtle); color: var(--dt-success); }
.method-put    { background: var(--dt-warning-subtle); color: var(--dt-warning); }
.method-patch  { background: oklch(24% 0.07 200); color: oklch(66% 0.18 200); }
.method-delete { background: var(--dt-danger-subtle);  color: var(--dt-danger); }

</style>
