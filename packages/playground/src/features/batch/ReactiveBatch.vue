<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const count = ref(3);
const { data, loading } = useApiBatch(
    () => Array.from({ length: count.value }, (_, i) => `/users/${i + 1}`),
    { immediate: true },
);

const code = `const count = ref(3)
const { data } = useApiBatch(
  () => Array.from({ length: count.value }, (_, i) => \`/users/\${i + 1}\`),
  { immediate: true },
)
// changing count auto-re-executes the batch`;
</script>

<template>
    <DemoWrapper title="Reactive Getter" description="Pass a getter function — batch re-executes automatically when its deps change." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>User count:</label>
            <button v-for="n in [1, 3, 5]" :key="n" @click="count = n"
                :style="{ padding: '4px 12px', cursor: 'pointer', fontWeight: count === n ? 700 : 400 }">{{ n }}</button>
        </div>
        <div v-if="loading">Fetching {{ count }} users...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="item in data" :key="item.index">{{ (item.data as { name: string })?.name }}</li>
        </ul>
    </DemoWrapper>
</template>
