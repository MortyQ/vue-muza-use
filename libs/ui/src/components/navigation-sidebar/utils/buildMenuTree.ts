import type { SidebarNavItem, SidebarRouteMeta } from "../types";

export interface FlatMenuItem {
  item: SidebarNavItem
  meta: SidebarRouteMeta
}

function ensureGroupNode(
  nodes: SidebarNavItem[],
  id: string,
  label: string,
  icon?: string,
  order?: number,
): SidebarNavItem {
  let node = nodes.find(n => n.id === id);
  if (!node) {
    node = { id, label, icon, order: order ?? 999, children: [] };
    nodes.push(node);
  }
  return node;
}

function insertIntoTree(
  root: SidebarNavItem[],
  item: SidebarNavItem,
  meta: SidebarRouteMeta,
): void {
  if (!meta.menuGroup) {
    root.push(item);
    return;
  }

  const segments = meta.menuGroup.split("/");
  let currentChildren = root;

  segments.forEach((segment, i) => {
    const segmentId = `group:${segments.slice(0, i + 1).join("/")}`;
    const segmentMeta = meta.menuGroupMeta?.[segment];
    const node = ensureGroupNode(
      currentChildren,
      segmentId,
      segment,
      segmentMeta?.icon ?? (i === 0 ? meta.menuGroupIcon : undefined),
      segmentMeta?.order ?? (i === 0 ? meta.menuGroupOrder : undefined),
    );
    currentChildren = node.children!;
  });

  currentChildren.push(item);
}

function sortDeep(items: SidebarNavItem[]): SidebarNavItem[] {
  return items
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(item => ({
      ...item,
      children: item.children?.length ? sortDeep(item.children) : undefined,
    }));
}

/**
 * Builds a sorted nested SidebarNavItem tree from a flat list.
 * Supports infinite depth via menuGroup "A/B/C" notation.
 *
 * @example
 * const tree = buildMenuTree([
 *   { item: { id: "dash", label: "Dashboard", to: "/" }, meta: {} },
 *   { item: { id: "q1", label: "Q1", to: "/q1" }, meta: { menuGroup: "Analytics" } },
 *   { item: { id: "jan", label: "January", to: "/jan" }, meta: { menuGroup: "Analytics/Q1" } },
 * ]);
 */
export function buildMenuTree(flatItems: FlatMenuItem[]): SidebarNavItem[] {
  const root: SidebarNavItem[] = [];
  for (const { item, meta } of flatItems) {
    insertIntoTree(root, item, meta);
  }
  return sortDeep(root);
}
