import { computed, inject, isRef, type ComputedRef, type Ref } from "vue";

import type { RouteLocationRaw } from "vue-router";

import type { SidebarInstance, SidebarNavItem } from "../types";

import { SIDEBAR_STATE_KEY } from "./injectionKeys";

// ── Base state (built from SidebarInstance, no navigation) ──────────────────

export interface SidebarStateBase {
  isCollapsed: Ref<boolean>
  isMobileOpen: Ref<boolean>
  expandedItems: Ref<Set<string>>
  resolvedItems: ComputedRef<SidebarNavItem[]>
  options: SidebarInstance["options"]
  toggleCollapse: () => void
  toggleExpanded: (id: string) => void
  isExpanded: (id: string) => boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
}

// ── Full provided state (base + navigation + events) ────────────────────────

export interface SidebarStateProvided extends SidebarStateBase {
  /** Id of the currently active leaf route item */
  activeItemId: ComputedRef<string | null>
  /** Set of all ids on the active path (root → active leaf) */
  activePathIds: ComputedRef<ReadonlySet<string>>
  /** O(1) check: is this item the current route? */
  isActive: (id: string) => boolean
  /** O(1) check: does this item (or any ancestor) lie on the active path? */
  isOnActivePath: (id: string) => boolean
  /** Emitted upward for route prefetching — sidebar doesn't import prefetchRoute */
  onPrefetch: (to: RouteLocationRaw) => void
}

// ── Factory — called once in NavigationSidebar.vue setup() ─────────────────

/**
 * Builds the base sidebar state from a SidebarInstance.
 * Called only in NavigationSidebar.vue; result is spread into provide().
 */
export function buildSidebarState(instance: SidebarInstance): SidebarStateBase {
  const resolvedItems = computed<SidebarNavItem[]>(() =>
    isRef(instance.items) ? instance.items.value : instance.items,
  );

  const toggleCollapse = (): void => {
    instance.isCollapsed.value = !instance.isCollapsed.value;
  };

  const toggleExpanded = (id: string): void => {
    const set = instance.expandedItems.value;
    if (set.has(id)) {
      set.delete(id);
    }
    else {
      set.add(id);
    }
    // Reassign to trigger reactivity on the Ref<Set>
    instance.expandedItems.value = new Set(set);
  };

  const isExpanded = (id: string): boolean => instance.expandedItems.value.has(id);

  const openMobile = (): void => {
    instance.isMobileOpen.value = true;
  };

  const closeMobile = (): void => {
    instance.isMobileOpen.value = false;
  };

  const toggleMobile = (): void => {
    instance.isMobileOpen.value = !instance.isMobileOpen.value;
  };

  return {
    isCollapsed: instance.isCollapsed,
    isMobileOpen: instance.isMobileOpen,
    expandedItems: instance.expandedItems,
    resolvedItems,
    options: instance.options,
    toggleCollapse,
    toggleExpanded,
    isExpanded,
    openMobile,
    closeMobile,
    toggleMobile,
  };
}

// ── Consumer — called in every child component ───────────────────────────────

/**
 * Returns the sidebar state provided by the nearest <NavigationSidebar>.
 * Throws if called outside the sidebar component tree.
 */
export function useSidebarState(): SidebarStateProvided {
  const state = inject(SIDEBAR_STATE_KEY);
  if (!state) {
    throw new Error(
      "[NavigationSidebar] useSidebarState() called outside of <NavigationSidebar>. "
      + "Make sure the component is wrapped in <NavigationSidebar :sidebar=\"...\">.",
    );
  }
  return state;
}
