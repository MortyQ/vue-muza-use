import type { InjectionKey } from "vue";

import type { SidebarStateProvided } from "./useSidebarState";

/**
 * Injection key for the sidebar state provided by <NavigationSidebar>.
 * Using Symbol prevents key collisions with other provide/inject pairs.
 */
export const SIDEBAR_STATE_KEY: InjectionKey<SidebarStateProvided> = Symbol("SidebarState");
