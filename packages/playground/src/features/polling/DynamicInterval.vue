<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const interval = ref(3000);
const requestCount = ref(0);
useApi("/analytics/summary", {
    immediate: true,
    poll: interval,
    onSuccess: () => requestCount.value++,
});

const code = `const interval = ref(3000)
useApi('/analytics/summary', {
  poll: interval, // reactive — change and polling restarts with new interval
})`;
</script>

<template>
    <DemoWrapper title="Dynamic Interval" description="poll accepts a ref — change the value to restart polling at the new interval." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button v-for="ms in [1000, 3000, 5000, 0]" :key="ms"
                @click="interval = ms"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: interval === ms ? 700 : 400 }">
                {{ ms === 0 ? 'Off' : ms + 'ms' }}
            </button>
        </div>
        <div style="font-size: 13px;">Requests: <strong>{{ requestCount }}</strong></div>
    </DemoWrapper>
</template>
