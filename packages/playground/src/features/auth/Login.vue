<script setup lang="ts">
import { ref } from "vue";
import { useApiPost, tokenManager } from "@ametie/vue-muza-use";
import { useAuthDemoStore } from "./store/useAuthDemoStore";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface LoginResponse { accessToken: string; refreshToken?: string }

const auth = useAuthDemoStore();
const email = ref(import.meta.env.VITE_AUTH_EMAIL as string ?? "");
const password = ref(import.meta.env.VITE_AUTH_PASSWORD as string ?? "");

const { loading, error, execute: login } = useApiPost<LoginResponse>("/auth/login", {
    onSuccess: ({ data }) => {
        tokenManager.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        auth.onLogin();
    },
    skipErrorNotification: true,
});

const code = `const { loading, execute: login } = useApiPost('/auth/login', {
  onSuccess: ({ data }) => {
    tokenManager.setTokens({ accessToken: data.accessToken })
  },
})
login({ data: { email, password } })`;
</script>

<template>
    <DemoWrapper title="Login / Logout" description="Authenticate with the live backend. Credentials pre-filled from .env." :code="code">
        <div v-if="!auth.isAuthenticated" style="display: flex; flex-direction: column; gap: 12px; max-width: 320px;">
            <div v-if="error" style="color: var(--ui-danger); font-size: 13px;">{{ error.message }}</div>
            <input v-model="email" type="email" placeholder="Email" style="padding: 8px; border: 1px solid var(--ui-border); border-radius: 6px;" />
            <input v-model="password" type="password" placeholder="Password" style="padding: 8px; border: 1px solid var(--ui-border); border-radius: 6px;" />
            <button :disabled="loading" style="padding: 10px; cursor: pointer;" @click="login({ data: { email, password } })">
                {{ loading ? 'Logging in...' : 'Login' }}
            </button>
        </div>
        <div v-else>
            <p style="color: var(--ui-success);">Authenticated ✓</p>
            <button style="padding: 8px 16px; cursor: pointer;" @click="auth.logout()">Logout</button>
        </div>
    </DemoWrapper>
</template>
