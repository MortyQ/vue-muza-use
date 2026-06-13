import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { tokenManager } from "@ametie/vue-muza-use";

export const useAuthDemoStore = defineStore("auth-demo", () => {
    const isAuthenticated = ref(!!tokenManager.getAccessToken());

    function onLogin(): void {
        isAuthenticated.value = true;
    }

    function logout(): void {
        tokenManager.clearTokens();
        isAuthenticated.value = false;
    }

    return { isAuthenticated: computed(() => isAuthenticated.value), onLogin, logout };
});
