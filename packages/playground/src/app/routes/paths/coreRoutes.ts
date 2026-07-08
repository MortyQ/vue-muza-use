import type { RouteRecordRaw } from "vue-router";
export const coreRoutes: RouteRecordRaw[] = [
    { path: "/core/basic", component: () => import("../../../pages/core/BasicFetchPage.vue") },
    { path: "/core/dynamic-url", component: () => import("../../../pages/core/DynamicUrlPage.vue") },
    { path: "/core/lazy", component: () => import("../../../pages/core/LazyPage.vue") },
    { path: "/core/debounce", component: () => import("../../../pages/core/DebouncePage.vue") },
    { path: "/core/select", component: () => import("../../../pages/core/SelectTransformPage.vue") },
    { path: "/core/auto-cache-keys", component: () => import("../../../pages/core/AutoCacheKeysPage.vue") },
];
