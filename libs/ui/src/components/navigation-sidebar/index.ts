// ── Public API for navigation-sidebar ───────────────────────────────────────
export { default as NavigationSidebar } from "./NavigationSidebar.vue";
export { default as NavigationSidebarMobile } from "./NavigationSidebarMobile.vue";
export { createSidebar } from "./createSidebar";
export { useSidebarState, buildSidebarState } from "./composables/useSidebarState";
export { useNavigation } from "./composables/useNavigation";
export { buildMenuTree } from "./utils/buildMenuTree";
export type { FlatMenuItem } from "./utils/buildMenuTree";
export type { SidebarNavItem, SidebarOptions, SidebarInstance, SidebarRouteMeta } from "./types";
