<!-- Cache details strip for the request detail view: resolved key with copy
     actions, humanized config, and a live freshness countdown. -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { RequestRecord, DevtoolsResolvedCache } from "../../../shared/types/index";
import { formatDuration, formatRemaining } from "../../../shared/utils/formatDuration";
import CopyButton from "../../../shared/components/CopyButton.vue";

const props = defineProps<{ request: RequestRecord; cache: NonNullable<DevtoolsResolvedCache> }>();

const expanded = ref(false);

// RequestDetail is not keyed by request id — the same instance survives
// selection changes, so collapse the key view when another request is shown.
watch(() => props.request.id, () => { expanded.value = false; });

const isAutoKey = computed(() => props.request.cacheKey?.startsWith("auto:") ?? false);

// Reconstructed from the record's own fields (matches resolveCacheKey in use-api);
// never parsed out of the key — URLs may legally contain ":".
const prefix = computed(() => `auto:${props.request.method.toUpperCase()}:${props.request.url}`);

// 1s ticker drives the countdown; runs only while the bar is mounted.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1_000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

type Freshness = { state: "fresh" | "swr" | "cached" | "expired"; remaining: number };

const freshness = computed<Freshness | null>(() => {
    const cachedAt = props.request.cachedAt;
    if (cachedAt === undefined) return null;
    const age = now.value - cachedAt;
    if (props.cache.swr && age < props.cache.freshFor) {
        return { state: "fresh", remaining: props.cache.freshFor - age };
    }
    if (age < props.cache.staleTime) {
        return { state: props.cache.swr ? "swr" : "cached", remaining: props.cache.staleTime - age };
    }
    return { state: "expired", remaining: 0 };
});

const countdownLabel = computed(() => {
    const f = freshness.value;
    if (!f) return "";
    switch (f.state) {
        case "fresh": return `fresh — ${formatRemaining(f.remaining)} left`;
        case "swr": return `revalidates on hit — stale in ${formatRemaining(f.remaining)}`;
        case "cached": return `cached — expires in ${formatRemaining(f.remaining)}`;
        case "expired": return "expired";
    }
});

const COUNTDOWN_TOOLTIP =
    "Freshness of the entry written by this request. Manual invalidateCache() calls "
    + "and overwrites by other instances with the same key are not tracked.";
</script>

<template>
    <div class="cache-info">
        <div v-if="request.cacheKey" class="cache-info__row">
            <span class="cache-info__label">key</span>
            <template v-if="isAutoKey">
                <span class="cache-info__prefix-label">prefix</span>
                <span class="cache-info__prefix" data-test="prefix-text">{{ prefix }}</span>
                <CopyButton :value="prefix" data-test="copy-prefix" />
                <span class="cache-info__sep">·</span>
            </template>
            <span
                class="cache-info__key"
                :class="{ expanded }"
                data-test="key-text"
                @click="expanded = !expanded"
            >{{ request.cacheKey }}</span>
            <CopyButton :value="request.cacheKey" data-test="copy-key" />
        </div>
        <div class="cache-info__row">
            <span class="cache-info__label">config</span>
            <span class="config-chip" data-test="config-chip">
                <span class="config-chip__key">staleTime</span>{{ formatDuration(cache.staleTime) }}
            </span>
            <span class="config-chip" data-test="config-chip">
                <span class="config-chip__key">freshFor</span>{{ formatDuration(cache.freshFor) }}
            </span>
            <span v-if="cache.swr" class="config-chip config-chip--swr" data-test="config-chip">swr</span>
            <span
                v-if="freshness"
                class="cache-info__countdown"
                :class="`cache-info__countdown--${freshness.state}`"
                data-test="countdown"
                :title="COUNTDOWN_TOOLTIP"
            >{{ countdownLabel }}</span>
        </div>
    </div>
</template>

<style scoped>
.cache-info {
    padding: 6px 12px;
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
}
.cache-info__row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.cache-info__label {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dt-foreground-subtle);
    width: 42px;
}
.cache-info__key {
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: oklch(68% 0.18 200);
    cursor: pointer;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cache-info__prefix {
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: var(--dt-foreground-secondary);
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cache-info__key.expanded {
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 72px;
    overflow-y: auto;
}
.cache-info__key.expanded::-webkit-scrollbar { width: 4px; }
.cache-info__key.expanded::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.cache-info__prefix-label { color: var(--dt-foreground-muted); }
.cache-info__sep { color: var(--dt-foreground-subtle); }
/* Static chips on a frequently-seen row — intentionally no transitions. */
.config-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    background: var(--dt-surface-raised);
    border: 1px solid var(--dt-border-subtle);
    border-radius: 4px;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 10px;
    color: var(--dt-foreground-secondary);
    white-space: nowrap;
    flex-shrink: 0;
}
.config-chip__key { color: var(--dt-foreground-muted); }
.config-chip--swr {
    background: oklch(22% 0.07 200);
    color: oklch(62% 0.16 200);
    border-color: oklch(32% 0.10 200);
}
.cache-info__countdown { margin-left: auto; white-space: nowrap; flex-shrink: 0; }
.cache-info__countdown--fresh   { color: oklch(72% 0.17 160); }
.cache-info__countdown--swr     { color: oklch(72% 0.17 65); }
.cache-info__countdown--cached  { color: oklch(68% 0.18 200); }
.cache-info__countdown--expired { color: var(--dt-foreground-subtle); }
</style>
