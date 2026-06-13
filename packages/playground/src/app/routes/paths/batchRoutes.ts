import type { RouteRecordRaw } from "vue-router";
export const batchRoutes: RouteRecordRaw[] = [
    { path: "/batch/basic", component: () => import("../../../pages/batch/BasicBatchPage.vue") },
    { path: "/batch/concurrency", component: () => import("../../../pages/batch/ConcurrencyPage.vue") },
    { path: "/batch/settled", component: () => import("../../../pages/batch/SettledErrorsPage.vue") },
    { path: "/batch/reactive", component: () => import("../../../pages/batch/ReactiveBatchPage.vue") },
];
