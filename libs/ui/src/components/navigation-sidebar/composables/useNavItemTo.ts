import { computed, type ComputedRef } from "vue";

import { useRoute, type LocationQuery, type RouteLocationRaw } from "vue-router";

import type { SidebarNavItem } from "../types";

/**
 * Resolves the `to` prop for a sidebar navigation item, preserving
 * persistent URL query params (e.g. brand, channel, date filters) across navigation.
 *
 * @param item - The sidebar nav item
 * @param persistentParams - List of query param keys to preserve. Default: [].
 *   Pass via SidebarOptions.persistentQueryParams (injected from useSidebarState).
 */
export function useNavItemTo(
  item: SidebarNavItem,
  persistentParams: string[] = [],
): { resolvedTo: ComputedRef<RouteLocationRaw | undefined> } {
  const route = useRoute();

  const resolvedTo = computed<RouteLocationRaw | undefined>(() => {
    const destination = item.to;
    if (!destination) return undefined;
    if (!persistentParams.length) return destination;

    // Collect only persistent params that are currently in the URL
    const preserved: Record<string, string> = {};
    for (const key of persistentParams) {
      const value = (route.query as LocationQuery)[key];
      if (value !== undefined && value !== null) {
        preserved[key] = Array.isArray(value) ? (value[0] ?? "") : (value as string);
      }
    }

    if (!Object.keys(preserved).length) return destination;

    if (typeof destination === "string") {
      return { path: destination, query: preserved };
    }

    // Object destination: merge preserved params; item's own query takes priority
    return {
      ...destination,
      query: {
        ...preserved,
        ...((destination as { query?: Record<string, string> }).query ?? {}),
      },
    };
  });

  return { resolvedTo };
}
