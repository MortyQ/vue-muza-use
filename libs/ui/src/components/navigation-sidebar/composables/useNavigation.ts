import { computed, shallowRef, watch, type ComputedRef } from "vue";

import { useRoute } from "vue-router";

import type { SidebarNavItem } from "../types";

// ── Types ────────────────────────────────────────────────────────────────────

interface RouteEntry {
  itemId: string
  /** Full ancestor chain root → this item (inclusive) */
  ancestorIds: string[]
  path?: string
  routeName?: string | symbol
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a flat array of all navigable items from a nested tree.
 * O(N) build on config change → O(1) lookups on every route change.
 */
function buildRouteLookup(
  items: SidebarNavItem[],
  ancestors: string[] = [],
): RouteEntry[] {
  const entries: RouteEntry[] = [];

  for (const item of items) {
    const chain = [...ancestors, item.id];

    if (item.to) {
      const entry: RouteEntry = { itemId: item.id, ancestorIds: chain };

      if (typeof item.to === "string") {
        entry.path = item.to;
      }
      else if (typeof item.to === "object" && "name" in item.to && item.to.name) {
        entry.routeName = item.to.name as string | symbol;
      }
      else if (typeof item.to === "object" && "path" in item.to && item.to.path) {
        entry.path = item.to.path as string;
      }

      entries.push(entry);
    }

    if (item.children?.length) {
      entries.push(...buildRouteLookup(item.children, chain));
    }
  }

  return entries;
}

// ── Composable (per-instance, NOT a singleton) ───────────────────────────────

export interface UseNavigationReturn {
  activeItemId: ComputedRef<string | null>
  activePathIds: ComputedRef<ReadonlySet<string>>
  isActive: (id: string) => boolean
  isOnActivePath: (id: string) => boolean
}

/**
 * Per-instance navigation resolver.
 * Called ONCE in NavigationSidebar.vue setup(); result is spread into provide().
 * No module-level state — safe for multiple sidebar instances on the same page.
 */
export function useNavigation(
  items: ComputedRef<SidebarNavItem[]>,
): UseNavigationReturn {
  const route = useRoute();

  // Rebuild flat lookup whenever nav config changes — O(N) once, O(1) per route change
  const routeLookup = computed(() => buildRouteLookup(items.value));

  const _activeItemId = shallowRef<string | null>(null);
  const _activePathIds = shallowRef<ReadonlySet<string>>(new Set<string>());

  watch(
    () => ({ path: route.path, name: route.name }),
    ({ path, name }) => {
      let matched: RouteEntry | undefined;

      for (const entry of routeLookup.value) {
        if (entry.path && entry.path === path) {
          matched = entry;
          break;
        }
        if (entry.routeName && entry.routeName === name) {
          matched = entry;
          break;
        }
      }

      if (matched) {
        _activeItemId.value = matched.itemId;
        _activePathIds.value = new Set(matched.ancestorIds);
      }
      else {
        _activeItemId.value = null;
        _activePathIds.value = new Set<string>();
      }
    },
    { immediate: true },
  );

  const activeItemId = computed(() => _activeItemId.value);
  const activePathIds = computed(() => _activePathIds.value);

  const isActive = (id: string): boolean => _activeItemId.value === id;
  const isOnActivePath = (id: string): boolean => _activePathIds.value.has(id);

  return { activeItemId, activePathIds, isActive, isOnActivePath };
}

/**
 * Reset helper — useful in tests.
 * @deprecated Not needed in per-instance architecture; kept for backwards compat.
 */
export function resetNavigation(): void { /* noop */
}
