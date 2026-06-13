<script setup lang="ts">
import { useApi, tokenManager } from "@ametie/vue-muza-use";
import { useAuthDemoStore } from "./store/useAuthDemoStore";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const auth = useAuthDemoStore();
const { data, loading, execute } = useApi("/me", { skipErrorNotification: true });

const code = `// createApiClient handles 401 → token refresh automatically
// When /me returns 401, the interceptor:
// 1. Calls POST /auth/refresh with { refreshToken }
// 2. Updates tokens via tokenManager.setTokens()
// 3. Retries the original request with the new accessToken`;
</script>

<template>
    <DemoWrapper title="Token Refresh" description="The axios interceptor transparently refreshes the access token on 401 and retries the request." :code="code">
        <div v-if="!auth.isAuthenticated" style="color: var(--ui-foreground-muted); font-size: 13px;">
            Log in first via Auth → Login / Logout.
        </div>
        <div v-else>
            <div style="font-size: 13px; margin-bottom: 12px;">
                Token: <code style="font-size: 11px;">{{ tokenManager.getAccessToken()?.slice(0, 30) }}...</code>
            </div>
            <div v-if="loading">Fetching protected endpoint...</div>
            <div v-else-if="data">Response: {{ JSON.stringify(data).slice(0, 100) }}</div>
            <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Call /me</button>
        </div>
    </DemoWrapper>
</template>
