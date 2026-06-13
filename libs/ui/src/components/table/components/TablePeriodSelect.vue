<script lang="ts" setup>
/**
 * TablePeriodSelect Component (Generic)
 *
 * Reusable period selector for tables (Month/Week/Day filtering).
 * Receives granularity and dateRange as props — no store dependencies.
 *
 * @example
 * ```vue
 * <TablePeriodSelect
 *   :granularity="computed(() => filtersStore.currentGranularity)"
 *   :date-range="computed(() => filtersStore.formattedPrimaryInterval)"
 *   include-summary
 *   @change="handlePeriodChange"
 * />
 * ```
 */
import { toRef } from "vue";

import { VSelect } from "../../../index";
import {
  useTablePeriodSelect,
  type PeriodOption,
  type PeriodRequestParams,
  type PeriodGranularity,
  type PeriodDateRange,
} from "../composables/useTablePeriodSelect";

// ==================== Types ====================

export interface PeriodChangePayload {
  /** Selected period option */
  selected: PeriodOption
  /** Request params to spread into API call */
  requestParams: PeriodRequestParams
  /** Whether to group by date (false when "Summary" is selected) */
  isGroupByDate: boolean
}

// ==================== Props ====================

interface Props {
  /**
   * Current granularity (reactive).
   * Controls which period options are generated.
   */
  granularity: PeriodGranularity

  /**
   * Current date range (reactive).
   * Defines the boundaries for available period options.
   */
  dateRange: PeriodDateRange

  /**
   * Include "Summary" option in the list
   * @default false
   */
  includeSummary?: boolean

  /**
   * Custom width class for the select
   * @default 'w-40'
   */
  widthClass?: string

  /**
   * Placeholder text
   * @default 'Select period'
   */
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  includeSummary: false,
  widthClass: "w-40",
  placeholder: "Select period",
});

// ==================== Emits ====================

const emit = defineEmits<{
  /**
   * Emitted when period selection changes
   * Contains all needed data for API request
   */
  change: [payload: PeriodChangePayload]
}>();

// ==================== Composable ====================

const {
  selectedPeriod,
  periodOptions,
  periodRequestParams,
  isGroupByDate,
  handlePeriodChange: internalHandlePeriodChange,
} = useTablePeriodSelect({
  granularity: toRef(props, "granularity"),
  dateRange: toRef(props, "dateRange"),
  includeSummary: props.includeSummary,
  onPeriodChange: () => {
    emitChange();
  },
});

// ==================== Methods ====================

const emitChange = () => {
  emit("change", {
    selected: selectedPeriod.value,
    requestParams: periodRequestParams.value,
    isGroupByDate: isGroupByDate.value,
  });
};

const handleSelect = (option: unknown) => {
  internalHandlePeriodChange(option as PeriodOption);
};

// ==================== Expose ====================

/**
 * Expose reactive values for parent access if needed
 */
defineExpose({
  selectedPeriod,
  periodRequestParams,
  isGroupByDate,
});
</script>

<template>
  <div class="w-[160px]">
    <VSelect
      v-model="selectedPeriod"
      :class="widthClass"
      :close-on-select="true"
      :options="periodOptions"
      :placeholder="placeholder"
      :searchable="false"
      v-bind="$attrs"
      @select="handleSelect"
    />
  </div>
</template>
