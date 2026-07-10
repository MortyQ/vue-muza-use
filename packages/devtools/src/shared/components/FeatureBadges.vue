<!-- Renders feature badges (cache, swr, polling, etc.) for a useApi instance. -->
<script setup lang="ts">
import { computed } from "vue";
import type { DevtoolsInstanceOptions } from "../types/index";

const props = defineProps<{ options: DevtoolsInstanceOptions }>();

type BadgeVariant = "cache" | "swr" | "polling" | "retry" | "batch" | "debounce" | "lazy";

interface Badge {
    key: string;
    label: string;
    sub?: string;
    variant: BadgeVariant;
}

const MAX_SUB_LENGTH = 12;

const truncateSub = (sub: string): string =>
    sub.length > MAX_SUB_LENGTH ? `${sub.slice(0, MAX_SUB_LENGTH)}…` : sub;

const badges = computed<Badge[]>(() => {
    const b: Badge[] = [];
    const { cache, poll, retry, batch, debounce, lazy } = props.options;

    // `cache` is the resolved config (cacheDefaults already merged in) — `id`
    // present only for a manual key, "auto" otherwise; `swr` reflects the true
    // effective value even when it comes from cacheDefaults, not this instance.
    // SWR implies caching, so a single merged chip (swr·auto / swr·<id>)
    // replaces the cache + swr pair.
    if (cache) {
        const sub = truncateSub(cache.id ?? "auto");
        if (cache.swr) {
            b.push({ key: "swr", label: "swr", sub, variant: "swr" });
        } else {
            b.push({ key: "cache", label: "cache", sub, variant: "cache" });
        }
    }
    if (poll)     b.push({ key: "polling",  label: "polling",  variant: "polling"  });
    if (retry)    b.push({ key: "retry",    label: "retry",    variant: "retry"    });
    if (batch)    b.push({ key: "batch",    label: "batch",    variant: "batch"    });
    if (debounce) b.push({ key: "debounce", label: "debounce", variant: "debounce" });
    if (lazy) b.push({ key: "lazy", label: "lazy", variant: "lazy" });

    return b;
});
</script>

<template>
    <div v-if="badges.length" class="feature-badges">
        <span
            v-for="badge in badges"
            :key="badge.key"
            class="badge"
            :class="`badge--${badge.variant}`"
        >
            {{ badge.label }}<template v-if="badge.sub"><span class="sep">·</span>{{ badge.sub }}</template>
        </span>
    </div>
</template>

<style scoped>
@reference "tailwindcss";

.feature-badges {
    @apply flex items-center gap-1 shrink-0 overflow-hidden;
}

.badge {
    @apply text-[9px] font-semibold tracking-[0.4px] uppercase px-[5px] py-px rounded-[3px] whitespace-nowrap shrink-0 border border-solid;
}

.sep {
    @apply opacity-40 mx-0.5;
}

/* Data strategy — cyan */
.badge--cache { background: oklch(22% 0.07 200); color: oklch(68% 0.18 200); border-color: oklch(32% 0.10 200); }
.badge--swr   { background: oklch(22% 0.07 200); color: oklch(62% 0.16 200); border-color: oklch(32% 0.10 200); }

/* Behavior modifiers — amber */
.badge--retry    { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }
.badge--debounce { background: oklch(22% 0.07 65); color: oklch(68% 0.16 65); border-color: oklch(34% 0.10 65); }
.badge--polling  { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }

/* Request shape — neutral purple */
.badge--batch { background: oklch(20% 0.05 270); color: oklch(62% 0.10 270); border-color: oklch(30% 0.07 270); }
.badge--lazy  { background: oklch(20% 0.04 270); color: oklch(55% 0.08 270); border-color: oklch(28% 0.06 270); }
</style>
