import { computed, type Ref, type ComputedRef } from "vue";

import type { Column, HeaderCell } from "../types";

/**
 * Composable for working with grouped headers (multi-level headers)
 *
 * Handles:
 * - Detecting if columns have groups
 * - Flattening tree structure to leaf columns
 * - Building header rows for each level
 * - Calculating colspan for groups
 * - Dynamic width calculation for groups based on children
 *
 * @param columns - Reactive array of columns (can be nested)
 * @param columnWidths - Map with dynamic widths from useColumnResize
 */
export function useGroupedHeaders(
  columns: Ref<Column[]> | ComputedRef<Column[]>,
  columnWidths: Ref<Map<string, number>>,
) {
  const DEFAULT_COLUMN_WIDTH = 150;

  /**
   * Check if columns have any groups (children property)
   * OPTIMIZATION: Return false early if no groups detected
   */
  const hasGroups = computed(() => {
    const checkForGroups = (cols: Column[]): boolean => {
      return cols.some(col => !!(col.children && col.children.length > 0));
    };
    return checkForGroups(columns.value);
  });

  /**
   * Get max depth of column hierarchy
   */
  const getMaxDepth = (cols: Column[], currentDepth = 1): number => {
    let maxDepth = currentDepth;

    cols.forEach((col) => {
      if (col.children && col.children.length > 0) {
        const childDepth = getMaxDepth(col.children, currentDepth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    });

    return maxDepth;
  };

  /**
   * Extract all leaf columns (columns without children)
   * This is the flat list used for data rows and grid template
   */
  const flatColumns = computed<Column[]>(() => {
    const flat: Column[] = [];

    const traverse = (cols: Column[]) => {
      cols.forEach((col) => {
        if (col.children && col.children.length > 0) {
          // Has children - go deeper
          traverse(col.children);
        }
        else {
          // Leaf column - add to flat list
          flat.push(col);
        }
      });
    };

    traverse(columns.value);
    return flat;
  });

  /**
   * Calculate colspan for a column (how many leaf columns it spans)
   */
  const getColspan = (column: Column): number => {
    if (!column.children || column.children.length === 0) {
      return 1; // Leaf column
    }

    // Group - sum of children colspans
    return column.children.reduce((sum, child) => {
      return sum + getColspan(child);
    }, 0);
  };

  /**
   * Parse width string to number (px)
   */
  const parseWidth = (width?: string): number => {
    if (!width) return DEFAULT_COLUMN_WIDTH;

    if (width.endsWith("px")) {
      return parseInt(width, 10);
    }

    // For fr, auto, etc - use default
    return DEFAULT_COLUMN_WIDTH;
  };

  /**
   * Get actual width of column considering dynamic columnWidths
   */
  const getColumnWidth = (column: Column): number => {
    // Try dynamic width first (from resize)
    const dynamicWidth = columnWidths.value.get(column.key);
    if (dynamicWidth !== undefined) {
      return dynamicWidth;
    }

    // Fallback to static width
    return parseWidth(column.width);
  };

  /**
   * Calculate total width of a group (sum of all leaf children)
   */
  const getGroupWidth = (column: Column): number => {
    if (!column.children || column.children.length === 0) {
      // Leaf column
      return getColumnWidth(column);
    }

    // Group - recursive sum of children widths
    return column.children.reduce((sum, child) => {
      return sum + getGroupWidth(child);
    }, 0);
  };

  /**
   * Build header cells for a specific level
   * Single columns (no children) appear only on level 0 with rowspan = maxDepth
   * Group columns appear on level 0, their children appear on deeper levels
   */
  const buildHeaderLevel = (
    cols: Column[],
    targetLevel: number,
    currentLevel = 0,
    maxDepth = 1,
  ): HeaderCell[] => {
    const cells: HeaderCell[] = [];

    cols.forEach((col) => {
      const isGroup = !!(col.children && col.children.length > 0);

      if (!isGroup) {
        // Leaf column
        if (currentLevel === targetLevel) {
          // Add leaf on its target level
          const isRootLevel = currentLevel === 0;
          cells.push({
            key: col.key,
            label: col.label,
            column: col,
            colspan: 1,
            rowspan: isRootLevel ? maxDepth : 1, // Root level spans all, others just 1
            isGroup: false,
            level: currentLevel,
          });
        }
      }
      else {
        // Group column
        if (currentLevel === targetLevel) {
          // Group header on its level
          cells.push({
            key: col.key,
            label: col.label,
            column: col,
            colspan: getColspan(col),
            rowspan: 1,
            isGroup: true,
            level: currentLevel,
          });
        }

        // Always recurse into children if we haven't reached target level yet
        if (currentLevel < targetLevel) {
          cells.push(...buildHeaderLevel(col.children!, targetLevel, currentLevel + 1, maxDepth));
        }
      }
    });

    return cells;
  };

  /**
   * Build all header rows (one row per level)
   * OPTIMIZATION: Only computed when hasGroups is true
   */
  const headerLevels = computed<HeaderCell[][]>(() => {
    if (!hasGroups.value) {
      // No groups - return single level with all columns
      return [
        columns.value.map(col => ({
          key: col.key,
          label: col.label,
          column: col,
          colspan: 1,
          rowspan: 1,
          isGroup: false,
          level: 0,
        })),
      ];
    }

    // Has groups - build multiple levels
    const maxDepth = getMaxDepth(columns.value);
    const levels: HeaderCell[][] = [];

    for (let level = 0; level < maxDepth; level++) {
      levels.push(buildHeaderLevel(columns.value, level, 0, maxDepth));
    }

    return levels;
  });

  /**
   * Check if a group should be fixed
   * Group is fixed if ALL children have the same fixed direction
   */
  const isGroupFixed = (column: Column): "left" | "right" | null => {
    if (!column.children || column.children.length === 0) {
      return column.fixed || null;
    }

    // Recursively check all leaf descendants
    const getAllLeafFixed = (col: Column): ("left" | "right" | undefined)[] => {
      if (!col.children || col.children.length === 0) {
        return [col.fixed];
      }
      return col.children.flatMap(child => getAllLeafFixed(child));
    };

    const leafFixed = getAllLeafFixed(column);
    const allLeft = leafFixed.every(f => f === "left");
    const allRight = leafFixed.every(f => f === "right");

    if (allLeft) return "left";
    if (allRight) return "right";
    return null;
  };

  return {
    hasGroups, // Boolean - do we have grouped headers?
    flatColumns, // Flat list of leaf columns for data rows
    headerLevels, // Array of header rows (one per level)
    getGroupWidth, // Calculate width of group dynamically
    getColspan, // Get colspan for any column
    isGroupFixed, // Check if group should be sticky
  };
}
