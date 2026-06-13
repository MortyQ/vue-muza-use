/**
 * Table Period Select Composable (Generic)
 *
 * Provides period selection functionality for tables (Month/Week/Day filtering).
 * Unlike the app-specific version, this composable receives all external data
 * through options — no store dependencies.
 *
 * @example
 * ```ts
 * // In your app, create a configured wrapper:
 * const filtersStore = useGlobalFiltersStore();
 *
 * const {
 *   selectedPeriod,
 *   periodOptions,
 *   periodRequestParams,
 *   isGroupByDate,
 *   handlePeriodChange,
 * } = useTablePeriodSelect({
 *   granularity: computed(() => filtersStore.currentGranularity),
 *   dateRange: computed(() => filtersStore.formattedPrimaryInterval),
 *   includeSummary: true,
 *   onPeriodChange: (params, isGroupByDate) => { loadData(); },
 * });
 * ```
 */

import { ref, computed, watch, type Ref, type ComputedRef } from "vue";

import { DateTime } from "luxon";

// ==================== Types ====================

export type PeriodGranularity = "MONTH" | "WEEK" | "DAY";

export interface PeriodOption {
  label: string
  value: string

  [key: string]: unknown
}

export interface PeriodDateRange {
  since: string
  until: string
}

export interface PeriodRequestParams {
  period?: {
    since: string
    until: string
  }
}

export interface UseTablePeriodSelectOptions {
  /**
     * Current granularity (reactive).
     * Controls which period options are generated (months, weeks, or days).
     */
  granularity: Ref<PeriodGranularity> | ComputedRef<PeriodGranularity>

  /**
     * Current date range (reactive).
     * Defines the boundaries for available period options.
     */
  dateRange: Ref<PeriodDateRange> | ComputedRef<PeriodDateRange>

  /**
     * Include "Summary" option in the list.
     * When selected, isGroupByDate becomes false.
     * @default false
     */
  includeSummary?: boolean

  /**
     * Callback when period changes (for triggering data refresh).
     */
  onPeriodChange?: (params: PeriodRequestParams, isGroupByDate: boolean) => void
}

// ==================== Composable ====================

export function useTablePeriodSelect(options: UseTablePeriodSelectOptions) {
  const {
    granularity,
    dateRange,
    includeSummary = false,
    onPeriodChange,
  } = options;

  // ==================== State ====================

  const selectedPeriod = ref<PeriodOption | null>(null);
  const isGroupByDate = ref(true);

  // ==================== Computed Options ====================

  /**
     * Generate period options based on current granularity and date range
     */
  const periodOptions = computed<PeriodOption[]>(() => {
    const gran = granularity.value;
    const opts: PeriodOption[] = [];

    // Default "All" option
    const allLabel = gran === "MONTH"
      ? "All Months"
      : gran === "WEEK"
        ? "All Weeks"
        : "All Days";

    opts.push({ label: allLabel, value: "all" });

    // Summary option (optional)
    if (includeSummary) {
      opts.push({ label: "Summary", value: "summary" });
    }

    // Generate period-specific options
    if (gran === "MONTH") {
      opts.push(...generateMonthOptions());
    }
    else if (gran === "WEEK") {
      opts.push(...generateWeekOptions());
    }
    else if (gran === "DAY") {
      opts.push(...generateDayOptions());
    }

    return opts;
  });

  /**
     * Default selected option (first in list)
     */
  const defaultPeriod = computed<PeriodOption>(() => periodOptions.value[0]);

  // ==================== Period Generators ====================

  function generateMonthOptions(): PeriodOption[] {
    const { since, until } = dateRange.value;
    const startDate = DateTime.fromISO(since, { zone: "utc" });
    const endDate = DateTime.fromISO(until, { zone: "utc" });

    const months: PeriodOption[] = [];
    let current = startDate.startOf("month");

    while (current <= endDate) {
      months.push({
        label: current.toFormat("MMMM yyyy"),
        value: current.toISODate() as string,
      });
      current = current.plus({ months: 1 });
    }

    // Sort descending (newest first)
    return months.sort((a, b) =>
      DateTime.fromISO(b.value).toMillis() - DateTime.fromISO(a.value).toMillis(),
    );
  }

  function generateWeekOptions(): PeriodOption[] {
    const { since, until } = dateRange.value;
    const startDate = DateTime.fromISO(since, { zone: "utc" });
    const endDate = DateTime.fromISO(until, { zone: "utc" });
    const today = DateTime.utc().startOf("day");

    const weeks: PeriodOption[] = [];

    // Start from the first Sunday on or after startDate
    let current = startDate.startOf("week").plus({ days: 6 }); // Sunday

    while (current <= endDate && current < today) {
      weeks.push({
        label: current.toFormat("MM/dd/yyyy"),
        value: current.toISODate() as string,
      });
      current = current.plus({ weeks: 1 });
    }

    // Sort descending (newest first)
    return weeks.sort((a, b) =>
      DateTime.fromISO(b.value).toMillis() - DateTime.fromISO(a.value).toMillis(),
    );
  }

  function generateDayOptions(): PeriodOption[] {
    const { since, until } = dateRange.value;
    const startDate = DateTime.fromISO(since, { zone: "utc" });
    const endDate = DateTime.fromISO(until, { zone: "utc" });
    const today = DateTime.utc().startOf("day");

    const days: PeriodOption[] = [];
    let current = startDate;

    while (current <= endDate && current < today) {
      days.push({
        label: current.toFormat("MM/dd/yyyy"),
        value: current.toISODate() as string,
      });
      current = current.plus({ days: 1 });
    }

    // Sort descending (newest first)
    return days.sort((a, b) =>
      DateTime.fromISO(b.value).toMillis() - DateTime.fromISO(a.value).toMillis(),
    );
  }

  // ==================== Request Params ====================

  /**
     * Convert selected period to API request params
     */
  const periodRequestParams = computed<PeriodRequestParams>(() => {
    const value = selectedPeriod.value?.value;

    if (!value || value === "all" || value === "summary") {
      return {};
    }

    const gran = granularity.value;

    if (gran === "MONTH") {
      const startDate = DateTime.fromISO(value, { zone: "utc" });
      const endDate = startDate.endOf("month");
      return {
        period: {
          since: value,
          until: endDate.toISODate() as string,
        },
      };
    }

    if (gran === "WEEK") {
      const startDate = DateTime.fromISO(value, { zone: "utc" });
      return {
        period: {
          since: value,
          until: startDate.plus({ days: 6 }).toISODate() as string,
        },
      };
    }

    if (gran === "DAY") {
      return {
        period: {
          since: value,
          until: value,
        },
      };
    }

    return {};
  });

  // ==================== Handlers ====================

  /**
     * Handle period selection change
     */
  const handlePeriodChange = (option: PeriodOption) => {
    selectedPeriod.value = option;

    // Update isGroupByDate based on selection
    isGroupByDate.value = option.value !== "summary";

    // Trigger callback if provided
    if (onPeriodChange) {
      onPeriodChange(periodRequestParams.value, isGroupByDate.value);
    }
  };

  /**
     * Reset to default period
     */
  const resetPeriod = async () => {
    selectedPeriod.value = defaultPeriod.value;
    isGroupByDate.value = true;

    // Wait for computed values to update before triggering callback
    // await nextTick();

    // Trigger callback to notify parent about reset
    if (onPeriodChange) {
      onPeriodChange(periodRequestParams.value, isGroupByDate.value);
    }
  };

  // ==================== Watch for filter changes ====================

  // Reset period when granularity or date range changes
  watch(
    () => [granularity.value, dateRange.value],
    () => {
      resetPeriod();
    },
    { flush: "pre", deep: true },
  );

  // Initialize with default
  if (!selectedPeriod.value) {
    selectedPeriod.value = defaultPeriod.value;
  }

  // ==================== Return ====================

  return {
    /** Currently selected period */
    selectedPeriod: selectedPeriod as Ref<PeriodOption>,
    /** Available period options for dropdown */
    periodOptions,
    /** Default period option */
    defaultPeriod,
    /** Request params to spread into API call */
    periodRequestParams,
    /** Whether to group by date (false when "Summary" is selected) */
    isGroupByDate,
    /** Handle period selection change */
    handlePeriodChange,
    /** Reset to default period */
    resetPeriod,
  };
}
