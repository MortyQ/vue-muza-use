<script setup lang="ts">
import type { UseApiReturn } from "@ametie/vue-muza-use";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const labels = ["200 OK", "404 Not Found", "404 (retry x2)", "Aborted", "Public (no auth)", "Optional auth"];

const instances: UseApiReturn<unknown, unknown>[] = [
    useApi("/me", { immediate: true, skipErrorNotification: true }),
    useApi("/lists/00000000-0000-0000-0000-000000000001", { immediate: true, skipErrorNotification: true }),
    useApi("/lists/00000000-0000-0000-0000-000000000002", { immediate: true, skipErrorNotification: true, retry: 2, retryDelay: 300 }),
    useApi("/analytics/summary", { immediate: true, skipErrorNotification: true }),
    useApi("/health", { immediate: true, skipErrorNotification: true, authMode: "public" }),
    useApi("/lists", { immediate: true, skipErrorNotification: true, authMode: "optional" }),
];

function abortFourth(): void {
    instances[3]?.abort("manual abort");
}
</script>

<template>
    <DemoWrapper
        title="Error States"
        description="6 instances with different outcomes side by side. Open devtools to see all states in the Instances and Network tabs."
    >
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div
                v-for="(label, i) in labels" :key="i"
                style="padding: 10px; border-radius: 6px; border: 1px solid var(--ui-border-subtle);"
            >
                <div style="font-weight: 600; margin-bottom: 4px;">{{ label }}</div>
                <div v-if="instances[i]?.loading.value" style="color: var(--ui-foreground-muted)">Loading...</div>
                <div v-else-if="instances[i]?.error.value" :style="{ color: 'var(--ui-danger)', fontSize: '12px' }">
                    {{ instances[i]?.error.value?.message }}
                </div>
                <div v-else style="color: var(--ui-success)">OK</div>
                <button v-if="i === 3" style="margin-top: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px;" @click="abortFourth()">Abort</button>
            </div>
        </div>
    </DemoWrapper>
</template>
