import { createApiClient } from "@ametie/vue-muza-use";

export const apiAxios = createApiClient({
    baseURL: import.meta.env.VITE_API_URL as string,
});
