import { computed, type ComputedRef, type Ref } from "vue";

import { RESPONSIVE_COLUMN_CONFIG } from "../../../utils/viewport";
import type { Column } from "../types";

const { DEFAULT_COLUMN_WIDTH } = RESPONSIVE_COLUMN_CONFIG;

/**
 * Composable for working with fixed columns (sticky left/right)
 *
 * Calculates:
 * - Positions (left/right offset) for each fixed column
 * - z-index for proper stacking
 * - CSS classes and inline styles
 *
 * @param columns - Reactive array of columns
 * @param columnWidths - Optional Map with dynamic widths (from useColumnResize)
 */
export function useFixedColumns(
  columns: Ref<Column[]> | ComputedRef<Column[]>,
  columnWidths?: Ref<Map<string, number>>,
) {
  // Divide columns into groups
  const leftFixedColumns = computed(() =>
    columns.value.filter(col => col.fixed === "left"),
  );

  const rightFixedColumns = computed(() =>
    columns.value.filter(col => col.fixed === "right"),
  );

  const normalColumns = computed(() =>
    columns.value.filter(col => !col.fixed),
  );

  // 🔥 REACTIVE: Computed offsets for left fixed columns
  // Automatically recalculates when columnWidths changes
  const leftOffsetsMap = computed(() => {
    // ⚡ IMPORTANT: Explicit read of columnWidths.value to create reactive dependency
    const widths = columnWidths?.value;

    const map = new Map<string, number>();
    let offset = 0;

    // Go through original columns array (preserving order)
    for (const col of columns.value) {
      if (col.fixed === "left") {
        map.set(col.key, offset);

        // Get width (dynamic or static)
        // eslint-disable-next-line no-useless-assignment
        let width = DEFAULT_COLUMN_WIDTH;
        if (widths) {
          const dynamicWidth = widths.get(col.key);
          if (dynamicWidth !== undefined) {
            width = dynamicWidth;
          }
          else {
            width = parseColumnWidth(col.width) || DEFAULT_COLUMN_WIDTH;
          }
        }
        else {
          width = parseColumnWidth(col.width) || DEFAULT_COLUMN_WIDTH;
        }

        offset += width;
      }
    }

    return map;
  });

  // 🔥 REACTIVE: Computed offsets for right fixed columns
  const rightOffsetsMap = computed(() => {
    // ⚡ IMPORTANT: Explicit read of columnWidths.value to create reactive dependency
    const widths = columnWidths?.value;

    const map = new Map<string, number>();
    const rightFixed = columns.value.filter(col => col.fixed === "right");

    // Calculate from right to left
    let offset = 0;
    for (let i = rightFixed.length - 1; i >= 0; i--) {
      const col = rightFixed[i];
      map.set(col.key, offset);

      // Get width (dynamic or static)
      // eslint-disable-next-line no-useless-assignment
      let width = DEFAULT_COLUMN_WIDTH;
      if (widths) {
        const dynamicWidth = widths.get(col.key);
        if (dynamicWidth !== undefined) {
          width = dynamicWidth;
        }
        else {
          width = parseColumnWidth(col.width) || DEFAULT_COLUMN_WIDTH;
        }
      }
      else {
        width = parseColumnWidth(col.width) || DEFAULT_COLUMN_WIDTH;
      }

      offset += width;
    }

    return map;
  });

  // z-index for stacking (leftmost columns have higher z-index)
  const getZIndex = (columnKey: string, column: Column): number => {
    const baseZIndex = 50; // Base for fixed columns

    if (column.fixed === "left") {
      // Find index in original array
      const index = columns.value.findIndex(col => col.key === columnKey);
      // Count how many left fixed columns before this one
      let leftFixedCount = 0;
      for (let i = 0; i < index; i++) {
        if (columns.value[i].fixed === "left") leftFixedCount++;
      }
      // Leftmost columns higher (larger z-index)
      return baseZIndex + (leftFixedColumns.value.length - leftFixedCount);
    }

    if (column.fixed === "right") {
      // Find index in original array
      const index = columns.value.findIndex(col => col.key === columnKey);
      // Count how many right fixed columns after this one
      let rightFixedCount = 0;
      for (let i = index + 1; i < columns.value.length; i++) {
        if (columns.value[i].fixed === "right") rightFixedCount++;
      }
      // Rightmost columns higher
      return baseZIndex + rightFixedCount + 1;
    }

    return 1; // Regular columns
  };

  // 🔥 REACTIVE: Map with styles for each column
  // Automatically recalculates when columnWidths or columns change
  const fixedStylesMap = computed(() => {
    const map = new Map<string, Record<string, string>>();

    columns.value.forEach((column) => {
      if (!column.fixed) {
        map.set(column.key, {});
        return;
      }

      const styles: Record<string, string> = {
        // position: sticky added through CSS classes!
        // zIndex also controlled through CSS for proper hierarchy
      };

      if (column.fixed === "left") {
        const offset = leftOffsetsMap.value.get(column.key) || 0;
        styles.left = `${offset}px`;
      }
      else if (column.fixed === "right") {
        const offset = rightOffsetsMap.value.get(column.key) || 0;
        styles.right = `${offset}px`;
      }

      map.set(column.key, styles);
    });

    return map;
  });

  // Get styles for fixed column - now reads from reactive Map
  const getFixedStyles = (column: Column) => {
    return fixedStylesMap.value.get(column.key) || {};
  };

  // Check if column is fixed
  const isFixed = (column: Column): boolean => {
    return !!column.fixed;
  };

  // Check if this is the last left fixed column (for shadow)
  const isLastLeftFixed = (columnKey: string): boolean => {
    if (leftFixedColumns.value.length === 0) return false;

    // Find last left fixed column in original order
    let lastLeftFixedKey: string | null = null;
    for (const col of columns.value) {
      if (col.fixed === "left") {
        lastLeftFixedKey = col.key;
      }
    }

    return lastLeftFixedKey === columnKey;
  };

  // Check if this is the first right fixed column (for shadow)
  const isFirstRightFixed = (columnKey: string): boolean => {
    if (rightFixedColumns.value.length === 0) return false;

    // Find first right fixed column in original order
    for (const col of columns.value) {
      if (col.fixed === "right") {
        return col.key === columnKey;
      }
    }

    return false;
  };

  return {
    leftFixedColumns,
    rightFixedColumns,
    normalColumns,
    getFixedStyles,
    isFixed,
    isLastLeftFixed,
    isFirstRightFixed,
    getZIndex,
  };
}

/**
 * Parses column width (only px values)
 * For fr, auto, % returns null
 */
function parseColumnWidth(width?: string): number | null {
  if (!width) return null;
  if (width.endsWith("px")) {
    return Number.parseInt(width, 10);
  }
  return null;
}
