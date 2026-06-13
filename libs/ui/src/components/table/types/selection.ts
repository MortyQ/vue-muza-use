import type { ExpandableRow } from "./index";

/**
 * Selection mode for table rows
 * - 'independent': Each row is selected independently
 * - 'dependent': Parent-child relationships affect selection
 */
export type SelectionMode = "independent" | "dependent";

/**
 * Configuration for multi-select behavior in table
 */
export interface MultiSelectConfig {
  /**
     * Enable multi-select mode
     * @default false
     */
  enabled: boolean

  /**
     * Selection mode for hierarchical data
     * @default 'independent'
     */
  selectionMode?: SelectionMode

  /**
     * Automatically select all children when parent is selected
     * Only works when selectionMode is 'dependent'
     * @default true
     */
  selectChildren?: boolean

  /**
     * Automatically select parent when all children are selected
     * Only works when selectionMode is 'dependent'
     * @default true
     */
  selectParent?: boolean

  /**
     * Show checkbox in table header to select/deselect all visible rows
     * @default true
     */
  showHeaderCheckbox?: boolean

  /**
     * Custom function to determine if a row can be selected
     */

  isRowSelectable?: (row: ExpandableRow) => boolean

  /**
     * Select only visible rows (considering expand/collapse state)
     * @default true
     */
  selectOnlyVisible?: boolean
}

/**
 * Checkbox state for header or parent rows
 */
export type CheckboxState = "checked" | "unchecked" | "indeterminate";
