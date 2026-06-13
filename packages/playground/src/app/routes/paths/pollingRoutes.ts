import type { RouteRecordRaw } from "vue-router";
export const pollingRoutes: RouteRecordRaw[] = [
    { path: "/polling/basic", component: () => import("../../../pages/polling/BasicPollingPage.vue") },
    { path: "/polling/when-hidden", component: () => import("../../../pages/polling/WhenHiddenPage.vue") },
    { path: "/polling/dynamic", component: () => import("../../../pages/polling/DynamicIntervalPage.vue") },
];
