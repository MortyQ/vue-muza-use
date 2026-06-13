import type { RouteRecordRaw } from "vue-router";
import { coreRoutes } from "./paths/coreRoutes";
import { batchRoutes } from "./paths/batchRoutes";
import { cacheRoutes } from "./paths/cacheRoutes";
import { pollingRoutes } from "./paths/pollingRoutes";
import { triggersRoutes } from "./paths/triggersRoutes";
import { retryRoutes } from "./paths/retryRoutes";
import { authRoutes } from "./paths/authRoutes";
import { stateRoutes } from "./paths/stateRoutes";
import { devtoolsRoutes } from "./paths/devtoolsRoutes";

export const routes: RouteRecordRaw[] = [
    ...coreRoutes, ...batchRoutes, ...cacheRoutes, ...pollingRoutes,
    ...triggersRoutes, ...retryRoutes, ...authRoutes, ...stateRoutes, ...devtoolsRoutes,
];
