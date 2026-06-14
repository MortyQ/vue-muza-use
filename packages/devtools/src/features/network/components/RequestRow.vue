<script setup lang="ts">
import type { RequestRecord, DevtoolsInstanceOptions, CacheOptions } from "../../../shared/types/index";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{
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
function getCacheId(opts: DevtoolsInstanceOptions): string | undefined {
    if (!opts.cache) return undefined;
    if (typeof opts.cache === "string") return opts.cache;
    return (opts.cache as CacheOptions).id;
}
function hasSwr(opts: DevtoolsInstanceOptions): boolean {
    if (!opts.cache || typeof opts.cache === "string") return false;
    return (opts.cache as CacheOptions).swr === true;
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
                <div v-if="instanceOptions" class="feature-badges">
                    <span v-if="instanceOptions.cache" class="feature-badge fb-cache">
                        cache<template v-if="getCacheId(instanceOptions)">
                            <span class="fb-sep">·</span>{{ getCacheId(instanceOptions) }}
                        </template>
                    </span>
                    <span v-if="hasSwr(instanceOptions)" class="feature-badge fb-swr">swr</span>
                    <span v-if="instanceOptions.poll" class="feature-badge fb-polling">polling</span>
                    <span v-if="instanceOptions.retry" class="feature-badge fb-retry">retry</span>
                    <span v-if="instanceOptions.batch" class="feature-badge fb-batch">batch</span>
                    <span v-if="instanceOptions.debounce" class="feature-badge fb-debounce">debounce</span>
                    <span v-if="!instanceOptions.immediate || instanceOptions.lazy" class="feature-badge fb-lazy">lazy</span>
                </div>
            </div>
            <!-- Bottom: status + duration + time -->
            <div class="row-meta">
                <StatusBadge :status="request.status" :status-code="request.statusCode" />
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
    min-height: 52px;
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

/* Feature badges */
.feature-badges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    overflow: hidden;
}
.feature-badge {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
}
.fb-sep { opacity: 0.4; margin: 0 2px; }
.fb-cache    { background: oklch(22% 0.06 220); color: oklch(66% 0.18 220); border: 1px solid oklch(32% 0.08 220); }
.fb-swr      { background: oklch(22% 0.08 190); color: oklch(66% 0.20 190); border: 1px solid oklch(32% 0.10 190); }
.fb-polling  { background: var(--dt-primary-subtle); color: var(--dt-primary); border: 1px solid oklch(38% 0.14 280); }
.fb-retry    { background: var(--dt-warning-subtle); color: var(--dt-warning); border: 1px solid oklch(34% 0.10 75); }
.fb-batch    { background: oklch(22% 0.06 300); color: oklch(68% 0.18 300); border: 1px solid oklch(32% 0.09 300); }
.fb-debounce { background: oklch(22% 0.06 50);  color: oklch(70% 0.16 50);  border: 1px solid oklch(32% 0.09 50); }
.fb-lazy     { background: oklch(20% 0.04 270); color: oklch(58% 0.08 270); border: 1px solid oklch(30% 0.06 270); }
</style>
