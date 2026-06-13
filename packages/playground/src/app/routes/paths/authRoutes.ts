import type { RouteRecordRaw } from "vue-router";
export const authRoutes: RouteRecordRaw[] = [
    { path: "/auth/login", component: () => import("../../../pages/auth/LoginPage.vue") },
    { path: "/auth/refresh", component: () => import("../../../pages/auth/TokenRefreshPage.vue") },
    { path: "/auth/modes", component: () => import("../../../pages/auth/AuthModesPage.vue") },
];
