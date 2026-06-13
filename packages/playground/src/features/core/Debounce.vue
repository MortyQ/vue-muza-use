<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const search = ref("");
const { data, loading } = useApi<User[]>(
    () => search.value ? `/users?search=${search.value}` : "/users",
    { immediate: true, debounce: 500 },
);

const code = `const search = ref('')
const { data, loading } = useApi<User[]>(
  () => search.value ? \`/users?search=\${search.value}\` : '/users',
  { immediate: true, debounce: 500 },
)`;
</script>

<template>
    <DemoWrapper title="Debounce" description="debounce: 500 waits 500ms after the last change before firing the request." :code="code">
        <input v-model="search" placeholder="Search users..." style="width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 12px;" />
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Searching...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="user in data" :key="user.id">{{ user.name }}</li>
        </ul>
    </DemoWrapper>
</template>
