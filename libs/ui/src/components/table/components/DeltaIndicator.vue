<script lang="ts" setup>
import { computed } from "vue";

import { VIcon } from "../../../index";
import { formatCurrency, formatNumber, formatPercentage } from "../../../utils/formatters";
import type { ColumnFormatOptions } from "../types";

export interface DeltaIndicatorProps {
  /**
   * Value to display with color + arrow treatment
   */
  value?: number
  /**
   * Format options — same API as VTable column format
   * @example { currency: { decimals: 2 } }
   * @example { percentage: { decimals: 1 } }
   * @example { number: "compact" }
   */
  format?: ColumnFormatOptions
  /**
   * Reverse positive/negative colors
   * Useful when lower is better (e.g., costs, errors)
   * @default false
   */
  reverse?: boolean
  /**
   * Size variant
   * @default 'default'
   */
  size?: "sm" | "default" | "lg"
  /**
   * Show arrow icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Show value even if it's 0
   * @default true
   */
  showZero?: boolean
}

const {
  value = 0,
  format = undefined,
  reverse = false,
  size = "default",
  showIcon = true,
  showZero = true,
} = defineProps<DeltaIndicatorProps>();

const hasValue = computed(() =>
  value !== null && value !== undefined,
);

const shouldShow = computed(() =>
  hasValue.value && (showZero || value !== 0),
);

const isPositive = computed(() => {
  if (!hasValue.value) return null;
  return reverse ? value < 0 : value > 0;
});

const isNegative = computed(() => {
  if (!hasValue.value) return null;
  return reverse ? value > 0 : value < 0;
});

const isZero = computed(() => value === 0);

const formattedValue = computed(() => {
  if (!hasValue.value) return "";

  const fmt = format;
  if (!fmt) return String(value);

  if (fmt.currency !== undefined) {
    if (typeof fmt.currency === "object") {
      const { code, decimals } = fmt.currency;
      return formatCurrency(value, { code, decimals });
    }
    if (typeof fmt.currency === "string") {
      return formatCurrency(value, fmt.currency);
    }
    return formatCurrency(value);
  }

  if (fmt.percentage !== undefined) {
    return formatPercentage(value, fmt.percentage === true ? undefined : fmt.percentage);
  }

  if (fmt.number !== undefined) {
    return formatNumber(value, fmt.number);
  }

  return String(value);
});

const sizeClasses = computed(() => {
  switch (size) {
    case "sm":
      return { text: "text-xs", icon: 12 };
    case "lg":
      return { text: "text-sm font-semibold", icon: 18 };
    default:
      return { text: "text-sm", icon: 14 };
  }
});
</script>

<template>
  <div
    v-if="shouldShow"
    :class="sizeClasses.text"
    class="flex items-center gap-0.5"
  >
    <template v-if="showIcon">
      <VIcon
        v-if="isPositive"
        :size="sizeClasses.icon"
        color="text-success"
        icon="lucide:arrow-up"
      />
      <VIcon
        v-else-if="isNegative"
        :size="sizeClasses.icon"
        color="text-negative"
        icon="lucide:arrow-down"
      />
      <VIcon
        v-else-if="isZero"
        :size="sizeClasses.icon"
        color="text-secondaryText"
        icon="lucide:minus"
      />
    </template>

    <span
      :class="{
        'text-success': isPositive,
        'text-negative': isNegative,
        'text-secondaryText': isZero,
      }"
    >
      {{ formattedValue }}
    </span>
  </div>
</template>
