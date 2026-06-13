<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const { data, mutate, execute } = useApi<User[]>("/users", { immediate: true });

function addFakeUser(): void {
    mutate((prev) => [...(prev ?? []), { id: 999, name: "Fake User", email: "fake@example.com" }]);
}

function clearData(): void {
    mutate(null);
}

const code = `const { data, mutate } = useApi<User[]>('/users', { immediate: true })

// Direct value
mutate([...data.value, newUser])

// Updater function (like setState)
mutate((prev) => [...(prev ?? []), newUser])`;
</script>

<template>
    <DemoWrapper title="Mutate" description="mutate() updates data without a network request. Supports direct value or updater function." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="addFakeUser()">Add Fake User (mutate)</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="clearData()">Clear (mutate null)</button>
        </div>
        <div style="font-size: 13px;">{{ data?.length ?? 0 }} users</div>
        <ul style="margin: 4px 0; padding: 0 0 0 16px; font-size: 13px;">
            <li v-for="user in data?.slice(0, 5)" :key="user.id">{{ user.name }}</li>
        </ul>
    </DemoWrapper>
</template>
