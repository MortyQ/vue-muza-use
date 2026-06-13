import type { RouteRecordRaw } from "vue-router";
export const retryRoutes: RouteRecordRaw[] = [
    { path: "/retry/basic", component: () => import("../../../pages/retry/AutoRetryPage.vue") },
    { path: "/retry/custom-codes", component: () => import("../../../pages/retry/CustomStatusCodesPage.vue") },
];
