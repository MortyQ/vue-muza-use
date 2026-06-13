import { ref, computed, type Ref } from "vue";

import type { ExpandableRow, FlattenedRow } from "../types";

export function useExpandableTable(data: Ref<ExpandableRow[]>) {
  // State of expanded rows (Set for O(1) lookup)
  const expandedRows = ref<Set<string | number>>(new Set());

  /**
     * Converts tree structure to flat list considering expanded state
     * This is the key function for working with TanStack Virtual
     */
  const flattenedData = computed<FlattenedRow[]>(() => {
    const result: FlattenedRow[] = [];

    const flatten = (
      rows: ExpandableRow[],
      depth = 0,
      parentId?: string | number,
    ) => {
      rows.forEach((row) => {
        const hasChildren = Boolean(
          row.children?.length
          || (row.expandable && row.expandedContent),
        );
        const isExpanded = expandedRows.value.has(row.id!);

        // Add parent row
        result.push({
          ...row,
          depth,
          parentId,
          hasChildren,
          isExpanded,
        });

        // If expanded AND has children — add them
        if (isExpanded && row.children?.length) {
          flatten(row.children, depth + 1, row.id!);
        }
      });
    };

    flatten(data.value);
    return result;
  });

  /**
     * Toggle expand state for specific row
     */
  const toggleRow = (id: string | number) => {
    if (expandedRows.value.has(id)) {
      expandedRows.value.delete(id);
    }
    else {
      expandedRows.value.add(id);
    }
    // Trigger reactivity
    expandedRows.value = new Set(expandedRows.value);
  };

  /**
     * Expand all rows
     */
  const expandAll = () => {
    const collectExpandableIds = (rows: ExpandableRow[]): (string | number)[] => {
      const ids: (string | number)[] = [];
      rows.forEach((row) => {
        if (row.children?.length || row.expandable) {
          ids.push(row.id!);
          if (row.children) {
            ids.push(...collectExpandableIds(row.children));
          }
        }
      });
      return ids;
    };

    expandedRows.value = new Set(collectExpandableIds(data.value));
  };

  /**
     * Collapse all rows
     */
  const collapseAll = () => {
    expandedRows.value.clear();
    expandedRows.value = new Set();
  };

  /**
     * Check if row is expandable
     */
  const isExpandable = (row: ExpandableRow): boolean => {
    return Boolean(row.children?.length || row.expandable);
  };

  return {
    flattenedData, // For passing to virtualizer
    expandedRows, // For UI indicators
    toggleRow, // For click handlers
    expandAll,
    collapseAll,
    isExpandable,
  };
}
