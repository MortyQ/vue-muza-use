<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const ENDPOINTS = ["/me", "/lists", "/analytics/summary", "/analytics/popular-tags", "/analytics/tasks-by-priority"];

const count = ref(3);
const { data, loading } = useApiBatch(
    () => ENDPOINTS.slice(0, count.value),
    { immediate: true },
);

const code = `const count = ref(3)
const ENDPOINTS = ['/me', '/lists', '/analytics/summary', ...]
const { data } = useApiBatch(
  () => ENDPOINTS.slice(0, count.value),
  { immediate: true },
)
// changing count auto-re-executes the batch`;
</script>

<template>
    <DemoWrapper title="Reactive Getter" description="Pass a getter function — batch re-executes automatically when its deps change." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>Request count:</label>
            <button v-for="n in [1, 3, 5]" :key="n" @click="count = n"
                :style="{ padding: '4px 12px', cursor: 'pointer', fontWeight: count === n ? 700 : 400 }">{{ n }}</button>
        </div>
        <div v-if="loading">Fetching {{ count }} endpoints...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="item in data" :key="item.index">{{ item.url }}: {{ item.success ? 'OK' : item.error?.message }}</li>
        </ul>
    </DemoWrapper>
</template>
