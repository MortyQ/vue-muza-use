<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const { data } = useApi<User[], unknown, string[]>(
    "/users",
    { immediate: true, select: (users) => users.map((u) => u.name) },
);

const code = `const { data } = useApi<User[], unknown, string[]>(
  '/users',
  {
    immediate: true,
    select: (users) => users.map((u) => u.name),
  },
)
// data is string[], not User[]`;
</script>

<template>
    <DemoWrapper title="Select Transform" description="select transforms the raw response before storing it. data is typed as the output of select." :code="code">
        <p style="color: var(--ui-foreground-muted); font-size: 13px;">data type: string[] (names only)</p>
        <ul style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="name in data" :key="name">{{ name }}</li>
        </ul>
    </DemoWrapper>
</template>
