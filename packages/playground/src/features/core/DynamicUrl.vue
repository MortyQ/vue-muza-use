<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const userId = ref(1);
const { data, loading } = useApi<User>(() => `/users/${userId.value}`, { immediate: true });

const code = `const userId = ref(1)
const { data, loading } = useApi<User>(() => \`/users/\${userId.value}\`, {
  immediate: true,
})
// changing userId.value auto-triggers a new request`;
</script>

<template>
    <DemoWrapper title="Dynamic URL" description="Reactive URL — changing userId triggers a new request automatically." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button v-for="id in [1, 2, 3]" :key="id" @click="userId = id"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: userId === id ? 700 : 400 }">
                User {{ id }}
            </button>
        </div>
        <div v-if="loading">Loading...</div>
        <div v-else-if="data">{{ data.name }} — {{ data.email }}</div>
    </DemoWrapper>
</template>
