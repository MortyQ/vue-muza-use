import type { RouteRecordRaw } from "vue-router";
export const triggersRoutes: RouteRecordRaw[] = [
    { path: "/triggers/focus", component: () => import("../../../pages/triggers/RefetchOnFocusPage.vue") },
    { path: "/triggers/reconnect", component: () => import("../../../pages/triggers/RefetchOnReconnectPage.vue") },
];
