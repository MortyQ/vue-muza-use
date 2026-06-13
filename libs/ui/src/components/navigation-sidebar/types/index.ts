import type { MaybeRef, Ref } from "vue";

import type { RouteLocationRaw } from "vue-router";

export type { SidebarRouteMeta } from "./routeMeta";

/**
 * Sidebar navigation item
 * Supports infinite nesting through children array
 */
export interface SidebarNavItem {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Icon name (e.g., "mdi:home") */
  icon?: string
  /** Route destination */
  to?: RouteLocationRaw
  /** Click handler (alternative to navigation) */
  onClick?: () => void
  /** Child navigation items (creates collapsible menu) */
  children?: SidebarNavItem[]
  /** Disabled state */
  disabled?: boolean
  /** Badge text or count */
  badge?: string | number
  /** External link */
  external?: boolean
  /** Hide in navigation */
  hidden?: boolean
  /** Sort order for tree building */
  order?: number
  /** Custom metadata */
  meta?: Record<string, unknown>
}

/**
 * Options passed to createSidebar() factory
 */
export interface SidebarOptions {
  /** Navigation items array or computed ref */
  items: MaybeRef<SidebarNavItem[]>
  /** Brand name shown in header */
  brandName?: string
  /** Logo URL */
  logoUrl?: string
  /** localStorage key for persisting state. Default: "ui-sidebar" */
  storageKey?: string
  /** Persist collapsed state between sessions. Default: true */
  persistCollapse?: boolean
  /** URL query params to preserve during navigation. Default: [] */
  persistentQueryParams?: string[]
}

/**
 * Resolved sidebar instance returned by createSidebar()
 */
export interface SidebarInstance {
  items: MaybeRef<SidebarNavItem[]>
  isCollapsed: Ref<boolean>
  isMobileOpen: Ref<boolean>
  expandedItems: Ref<Set<string>>
  options: Required<Omit<SidebarOptions, "items">>
  toggleCollapse: () => void
  toggleMobile: () => void
}

/**
 * @deprecated Use SidebarOptions + createSidebar() instead
 */
export interface SidebarConfig {
  logo?: string
  brandName?: string
  items: SidebarNavItem[]
  footerItems?: SidebarNavItem[]
  showThemeToggle?: boolean
  showUserMenu?: boolean
}

/**
 * @deprecated
 */
export interface SidebarState {
  isCollapsed: boolean
  isMobileOpen: boolean
  expandedItems: Set<string>
}
