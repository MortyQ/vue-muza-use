<!-- Renders feature badges (cache, swr, polling, etc.) for a useApi instance. -->
<script setup lang="ts">
import { computed } from "vue";
import type { DevtoolsInstanceOptions, CacheOptions } from "../types/index";

const props = defineProps<{ options: DevtoolsInstanceOptions }>();

type BadgeVariant = "cache" | "swr" | "polling" | "retry" | "batch" | "debounce" | "lazy";

interface Badge {
    key: string;
    label: string;
    sub?: string;
    variant: BadgeVariant;
}

const badges = computed<Badge[]>(() => {
    const b: Badge[] = [];
    const { cache, poll, retry, batch, debounce, immediate, lazy } = props.options;

    if (cache) {
        const id = typeof cache === "string" ? cache : (cache as CacheOptions).id;
        b.push({ key: "cache", label: "cache", sub: id, variant: "cache" });
        if (typeof cache === "object" && (cache as CacheOptions).swr) {
            b.push({ key: "swr", label: "swr", variant: "swr" });
        }
    }
    if (poll)     b.push({ key: "polling",  label: "polling",  variant: "polling"  });
    if (retry)    b.push({ key: "retry",    label: "retry",    variant: "retry"    });
    if (batch)    b.push({ key: "batch",    label: "batch",    variant: "batch"    });
    if (debounce) b.push({ key: "debounce", label: "debounce", variant: "debounce" });
    if (!immediate || lazy) b.push({ key: "lazy", label: "lazy", variant: "lazy" });

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

.badge--cache    { background: oklch(22% 0.06 220); color: oklch(66% 0.18 220); border-color: oklch(32% 0.08 220); }
.badge--swr      { background: oklch(22% 0.08 190); color: oklch(66% 0.20 190); border-color: oklch(32% 0.10 190); }
.badge--polling  { background: var(--dt-primary-subtle); color: var(--dt-primary); border-color: oklch(38% 0.14 280); }
.badge--retry    { background: var(--dt-warning-subtle); color: var(--dt-warning); border-color: oklch(34% 0.10 75); }
.badge--batch    { background: oklch(22% 0.06 300); color: oklch(68% 0.18 300); border-color: oklch(32% 0.09 300); }
.badge--debounce { background: oklch(22% 0.06 50);  color: oklch(70% 0.16 50);  border-color: oklch(32% 0.09 50); }
.badge--lazy     { background: oklch(20% 0.04 270); color: oklch(58% 0.08 270); border-color: oklch(30% 0.06 270); }
</style>
