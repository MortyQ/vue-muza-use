import type { RouteRecordRaw } from "vue-router";
export const stateRoutes: RouteRecordRaw[] = [
    { path: "/state/mutate", component: () => import("../../../pages/state/MutatePage.vue") },
    { path: "/state/reset", component: () => import("../../../pages/state/ResetPage.vue") },
    { path: "/state/ignore-updates", component: () => import("../../../pages/state/IgnoreUpdatesPage.vue") },
];
