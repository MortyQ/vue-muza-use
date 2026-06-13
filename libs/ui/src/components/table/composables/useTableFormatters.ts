import {
  formatBoolean,
  formatCurrency,
  formatDate,
  formatFileSize,
  formatNumber,
  formatPercentage,
} from "../../../utils/formatters";
import type { Column, ColumnFormatOptions } from "../types";

/**
 * Universal table cell formatter
 * Supports: currency, percentage, number, date, boolean, file size, and custom formatters
 */

// Type for formatted cell value
export type FormattedCellValue = string | number | { text: string, class?: string };

/**
 * Main formatter function - applies formatting based on column configuration
 */
export const formatCellValue = (
  value: unknown,
  column: Column,
  row?: Record<string, unknown>,
): FormattedCellValue => {
  // No formatting options - return original value
  if (!column.format) {
    return value as string | number;
  }

  const format = column.format as ColumnFormatOptions;

  // Priority order: custom formatter > specific type formatters

  // 1. Custom formatter (highest priority)
  if (format.formatter) {
    return format.formatter(value, row);
  }

  // 2. Currency
  if (format.currency !== undefined && format.currency !== false) {
    const currencyOption = format.currency === true ? "USD" : format.currency;
    return formatCurrency(value, currencyOption);
  }

  // 3. Percentage
  if (format.percentage !== undefined) {
    return formatPercentage(value, format.percentage);
  }

  // 4. Number
  if (format.number) {
    return formatNumber(value, format.number);
  }

  // 5. Date
  if (format.date) {
    return formatDate(value, format.date);
  }

  // 6. Boolean
  if (format.boolean) {
    return formatBoolean(value, format.boolean);
  }

  // 7. File size
  if (format.fileSize !== undefined) {
    return formatFileSize(value, format.fileSize);
  }

  // No formatter matched - return original value
  return value as string | number;
};

/**
 * Composable for table formatters
 */
export const useTableFormatters = () => {
  return {
    formatCellValue,
    // Export individual formatters for custom use
    formatCurrency,
    formatPercentage,
    formatNumber,
    formatDate,
    formatBoolean,
    formatFileSize,
  };
};
