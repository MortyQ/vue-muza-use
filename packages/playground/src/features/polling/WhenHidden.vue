<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const pollWhenHidden = ref(false);
const requestCount = ref(0);
useApi("/users/1", {
    immediate: true,
    poll: { interval: 2000, whenHidden: pollWhenHidden },
    onSuccess: () => requestCount.value++,
});

const code = `const pollWhenHidden = ref(false)
useApi('/users/1', {
  poll: { interval: 2000, whenHidden: pollWhenHidden },
})
// whenHidden: false → polling pauses when browser tab is hidden`;
</script>

<template>
    <DemoWrapper title="When Hidden" description="whenHidden: false pauses polling when the browser tab loses focus." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>
                <input type="checkbox" v-model="pollWhenHidden" />
                Poll when tab hidden
            </label>
        </div>
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">Switch to another tab and watch the request count.</p>
        <div style="font-size: 13px;">Requests: <strong>{{ requestCount }}</strong></div>
    </DemoWrapper>
</template>
