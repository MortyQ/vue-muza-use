import { ref, watchEffect } from "vue";

import type { SidebarInstance, SidebarOptions } from "./types";

const STORAGE_PREFIX = "ui-sidebar";

function loadCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(`${key}:collapsed`) === "true";
  }
  catch {
    return false;
  }
}

function saveCollapsed(key: string, value: boolean): void {
  try {
    localStorage.setItem(`${key}:collapsed`, String(value));
  }
  catch { /* noop — storage unavailable */
  }
}

function loadExpandedItems(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${key}:expanded`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set<string>(parsed) : new Set();
  }
  catch {
    return new Set();
  }
}

function saveExpandedItems(key: string, value: Set<string>): void {
  try {
    localStorage.setItem(`${key}:expanded`, JSON.stringify([...value]));
  }
  catch { /* noop — storage unavailable */
  }
}

/**
 * Factory function that creates an isolated sidebar instance.
 * Each call returns independent reactive state — no module-level singletons.
 *
 * @example
 * const sidebar = createSidebar({
 *   items: computed(() => getMenuItems(authStore)),
 *   brandName: "My App",
 *   persistentQueryParams: ["brand", "channel"],
 * });
 */
export function createSidebar(options: SidebarOptions): SidebarInstance {
  const resolvedOptions: Required<Omit<SidebarOptions, "items">> = {
    brandName: options.brandName ?? "",
    logoUrl: options.logoUrl ?? "",
    storageKey: options.storageKey ?? STORAGE_PREFIX,
    persistCollapse: options.persistCollapse ?? true,
    persistentQueryParams: options.persistentQueryParams ?? [],
  };

  const isCollapsed = ref(false);
  const isMobileOpen = ref(false);
  const expandedItems = ref<Set<string>>(new Set());

  // SSR-safe lazy init — typeof window check prevents crash in server environments
  if (resolvedOptions.persistCollapse && typeof window !== "undefined") {
    isCollapsed.value = loadCollapsed(resolvedOptions.storageKey);
    expandedItems.value = loadExpandedItems(resolvedOptions.storageKey);

    watchEffect(() => {
      saveCollapsed(resolvedOptions.storageKey, isCollapsed.value);
    });

    watchEffect(() => {
      saveExpandedItems(resolvedOptions.storageKey, expandedItems.value);
    });
  }

  return {
    items: options.items,
    isCollapsed,
    isMobileOpen,
    expandedItems,
    options: resolvedOptions,
    toggleCollapse: () => {
      isCollapsed.value = !isCollapsed.value;
    },
    toggleMobile: () => {
      isMobileOpen.value = !isMobileOpen.value;
    },
  };
}
