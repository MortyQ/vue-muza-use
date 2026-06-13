// Export toolbar types
export * from "./toolbar";

// Formatter types
export type CurrencyFormatter = "USD" | "EUR" | "GBP" | "UAH" | string;
export type DateFormatter = "short" | "long" | "time" | "datetime" | string;
export type NumberFormatter = "default" | "compact" | "percent" | "decimal";

export interface ColumnFormatOptions {
  // Currency formatting
  // Usage: currency: true (defaults to USD), currency: "EUR", currency: { code: "GBP", decimals: 2 }
  currency?: boolean | CurrencyFormatter | { code?: CurrencyFormatter, decimals?: number }

  // Percentage formatting
  percentage?: boolean | { decimals?: number, multiplier?: boolean }

  // Number formatting
  number?: NumberFormatter | { type?: NumberFormatter, decimals?: number }

  // Date formatting
  date?: DateFormatter | { format?: DateFormatter, locale?: string }

  // Boolean formatting
  boolean?: { trueText?: string, falseText?: string, colored?: boolean }

  // File size formatting
  fileSize?: boolean | { decimals?: number }

  // Custom formatter function

  formatter?: (value: unknown, row?: Record<string, unknown>) => string | number
}

// Cell context for cellClass and cellStyle functions
// Provides named parameters for better developer experience
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CellContext<T = any> {
  value: unknown // Cell value
  row: T // Full row data
  rowIndex: number // Row index in current view
}

// Header context for onHeaderClick callback
// Provides information about the clicked header
// Note: Column type is used here but defined below - TypeScript allows this for interfaces
export interface HeaderContext {
  column: Column // Column definition (full access to all column properties)
  columnKey: string // Column key (shorthand for column.key)
  event: MouseEvent // Native click event for advanced use cases
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<TData = any> {
  key: string // Key from data object
  label: string // Header text
  width?: string | "flex" // Fixed width (e.g., "150px") - makes column resizable. Without width, column is flexible (not resizable)
  align?: "left" | "center" | "right" | string
  interactive?: boolean // Whether column contains interactive elements (select, dropdown, etc.)
  fixed?: "left" | "right" // Fix column (sticky) to left or right
  children?: Column<TData>[] // Nested columns for grouped headers (AG-Grid style)
  sortable?: boolean // Enable sorting for this column
  sortValue?: (row: TData, key: string) => unknown

  // Formatting options (mutually exclusive - only one should be used)
  format?: ColumnFormatOptions

  cellClass?: (context: CellContext<TData>) => string | undefined
  cellStyle?: (context: CellContext<TData>) => Record<string, string> | undefined

  onHeaderClick?: (context: HeaderContext) => void

  // Tooltip text for header info icon
  tooltip?: string
}

export interface HeaderCell {
  key: string
  label: string
  column: Column
  colspan: number // Number of leaf columns this cell spans
  rowspan: number // Number of header levels this cell spans (for single columns)
  isGroup: boolean // Is this a group header (has children)
  level: number // Depth level in hierarchy (0 = top)
}

export interface ExpandableRow {
  id?: string | number
  children?: ExpandableRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface FlattenedRow extends ExpandableRow {
  depth: number // Nesting level (0 = root)
  parentId?: string | number
  hasChildren: boolean
  isExpanded: boolean
}

export interface VirtualTableOptions {
  estimateSize?: number
  overscan?: number
  measureElement?: boolean
}

export interface ResizeState {
  isResizing: boolean
  columnKey: string | null
  startX: number
  startWidth: number
}

// Sort types
export type SortOrder = "asc" | "desc";
export type SortType = "front" | "server";

export interface SortItem {
  field: string // Column key
  order: SortOrder // Sort direction
}

export interface SortConfig {
  type?: SortType // Sort type: 'front' (client-side) or 'server' (default)
  multiple?: boolean // Allow multiple column sorting (default: true)
}

export interface RequestPayload {
  page: number
  pageSize?: number
  sort: SortItem[] // Always array, even for single sort
}

export interface FrontSortPayload {
  field: string
  order: SortOrder
  sortState: SortItem[] // Full sort state for multi-sort
}

// Pagination configuration
export interface PaginationConfig {
  page: number // Current page (1-based)
  pageSize: number // Items per page
  total: number // Total items count (required for server pagination)
  pageSizeOptions?: number[] // Available page size options (default: [10, 25, 50, 100])
  showSizeChanger?: boolean // Show page size selector (default: true)
}

// Re-export selection types
export type { MultiSelectConfig, SelectionMode, CheckboxState } from "./selection";

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    currentPage: number
    from: number
    pageSizeNumber: number
    to: number
    totalItems: number
    totalPages: number
  }
};

/**
 * Legacy TableHeader type for backward compatibility
 * Used in download utilities and legacy table components
 */
export interface TableHeader {
  name?: string // Display name for the column
  value: string // Property key in data object
  text?: string // Alternative to 'name' for display text
  reportName?: string // Alternative name for reports/export
  width?: string // Column width (e.g., "150px")
  sortable?: boolean // Whether column is sortable
  align?: "left" | "center" | "right" // Text alignment

  // Formatting flags (legacy approach)
  currency?: boolean // Format as currency
  currencySimbol?: string // Currency symbol override (e.g., "$", "€")
  currencyWithTwoDecimals?: boolean // Currency with 2 decimals
  isPercentage?: boolean // Format as percentage
  isNumber?: boolean // Is numeric value
  dividedForXlsx?: boolean // Divide value for XLSX export
  roundedWithZeroDecimals?: boolean // Round to 0 decimals
  roundedWithTwoDecimals?: boolean // Round to 2 decimals
  roundedWithTwoDecimalsAndMultiply?: boolean // Round to 2 decimals and multiply by 100
  roundedWithZeroDecimalsAndMultiply?: boolean // Round to 0 decimals and multiply by 100
  maxLength?: number // Max string length for truncation

  // Custom callback for formatting
  callback?: (row: TableRow) => string | number | boolean | null
}

/**
 * Legacy TableRow type for backward compatibility
 * Generic object that can contain any properties
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableRow = Record<string, any>;
