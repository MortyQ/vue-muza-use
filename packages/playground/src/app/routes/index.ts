import { createRouter, createWebHistory } from "vue-router";
import { routes } from "./modules";

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", redirect: "/core/basic" },
        ...routes,
        { path: "/:pathMatch(.*)*", redirect: "/core/basic" },
    ],
});
