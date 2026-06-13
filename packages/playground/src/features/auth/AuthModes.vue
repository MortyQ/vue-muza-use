<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data: publicData, execute: fetchPublic } = useApi("/users", { authMode: "public", skipErrorNotification: true });
const { data: optionalData, execute: fetchOptional } = useApi("/users/1", { authMode: "optional", skipErrorNotification: true });
const { data: defaultData, execute: fetchDefault } = useApi("/users/me", { authMode: "default", skipErrorNotification: true });

const code = `// authMode controls whether Authorization header is attached
useApi('/public-endpoint',  { authMode: 'public' })   // never sends token
useApi('/optional-endpoint',{ authMode: 'optional' })  // sends token if present
useApi('/protected',        { authMode: 'default' })   // always requires token`;
</script>

<template>
    <DemoWrapper title="Auth Modes" description="authMode controls whether the Authorization header is attached to the request." :code="code">
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>public</strong> — no token sent
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchPublic()">Test</button>
                <div v-if="publicData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>optional</strong> — token sent if available
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchOptional()">Test</button>
                <div v-if="optionalData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>default</strong> — token required (401 if missing)
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchDefault()">Test</button>
                <div v-if="defaultData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
        </div>
    </DemoWrapper>
</template>
