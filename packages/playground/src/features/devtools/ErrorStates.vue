<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const configs = [
    { label: "200 OK", url: "/users/1" },
    { label: "404 Not Found", url: "/users/99999" },
    { label: "404 (retry x2)", url: "/users/88888", opts: { retry: 2, retryDelay: 300 } },
    { label: "Aborted", url: "/users/2" },
    { label: "Public (no auth)", url: "/users/3", opts: { authMode: "public" as const } },
    { label: "Optional auth", url: "/users/4", opts: { authMode: "optional" as const } },
] as const;

const instances = configs.map(({ url, opts }) =>
    useApi(url, { immediate: true, skipErrorNotification: true, ...opts }),
);

function abortFourth(): void {
    instances[3].abort("manual abort");
}
</script>

<template>
    <DemoWrapper
        title="Error States"
        description="6 instances with different outcomes side by side. Open devtools to see all states in the Instances and Network tabs."
    >
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div
                v-for="(cfg, i) in configs" :key="i"
                style="padding: 10px; border-radius: 6px; border: 1px solid var(--ui-border-subtle);"
            >
                <div style="font-weight: 600; margin-bottom: 4px;">{{ cfg.label }}</div>
                <div v-if="instances[i].loading.value" style="color: var(--ui-foreground-muted)">Loading...</div>
                <div v-else-if="instances[i].error.value" :style="{ color: 'var(--ui-danger)', fontSize: '12px' }">
                    {{ instances[i].error.value?.message }}
                </div>
                <div v-else style="color: var(--ui-success)">OK</div>
                <button v-if="i === 3" style="margin-top: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px;" @click="abortFourth()">Abort</button>
            </div>
        </div>
    </DemoWrapper>
</template>
