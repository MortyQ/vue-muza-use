import type { RouteRecordRaw } from "vue-router";
export const devtoolsRoutes: RouteRecordRaw[] = [
    { path: "/devtools/kitchen-sink", component: () => import("../../../pages/devtools/KitchenSinkPage.vue") },
    { path: "/devtools/stress-test", component: () => import("../../../pages/devtools/StressTestPage.vue") },
    { path: "/devtools/errors", component: () => import("../../../pages/devtools/ErrorStatesPage.vue") },
];
