import { createApiClient, tokenManager } from "@ametie/vue-muza-use";

export const apiAxios = createApiClient({
    baseURL: import.meta.env.VITE_API_URL as string,
    authOptions: {
        refreshUrl: "/auth/refresh",
        refreshPayload: () => ({ refreshToken: tokenManager.getRefreshToken() }),
    },
});
