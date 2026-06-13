import type { RouteRecordRaw } from "vue-router";
export const cacheRoutes: RouteRecordRaw[] = [
    { path: "/cache/ttl", component: () => import("../../../pages/cache/TtlCachePage.vue") },
    { path: "/cache/swr", component: () => import("../../../pages/cache/SwrPage.vue") },
    { path: "/cache/invalidation", component: () => import("../../../pages/cache/InvalidationPage.vue") },
];
