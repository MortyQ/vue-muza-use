<script lang="ts" setup>
import { computed } from "vue";

import { VIcon } from "../../../index";

export interface DeltaValueProps {
  /**
   * Main value to display (optional)
   * If not provided, only delta will be shown
   */
  value?: number | string | null
  /**
   * Delta/change value (percentage or absolute)
   */
  delta?: number | null
  /**
   * Format options for main value
   */
  format?: {
    type?: "number" | "currency" | "percentage"
    decimals?: number
    currencyCode?: string
  }
  /**
   * Format options for delta value (optional)
   * If not provided, uses deltaAsPercentage and format.decimals
   */
  deltaFormat?: {
    type?: "number" | "currency" | "percentage"
    decimals?: number
    currencyCode?: string
  }
  /**
   * Whether delta represents percentage (adds % suffix)
   * @default true
   */
  deltaAsPercentage?: boolean
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
   * Show delta even if it's 0
   * @default true
   */
  showZeroDelta?: boolean
}

const props = withDefaults(defineProps<DeltaValueProps>(), {
  value: undefined,
  delta: undefined,
  format: undefined,
  deltaFormat: undefined,
  deltaAsPercentage: true,
  reverse: false,
  size: "default",
  showZeroDelta: true,
});

// Check if delta is positive
const isPositive = computed(() => {
  if (props.delta === null || props.delta === undefined) return null;
  return props.reverse ? props.delta < 0 : props.delta > 0;
});

// Check if delta is negative
const isNegative = computed(() => {
  if (props.delta === null || props.delta === undefined) return null;
  return props.reverse ? props.delta > 0 : props.delta < 0;
});

// Check if delta is zero
const isZero = computed(() => {
  return props.delta === 0;
});

// Should show delta
const showDelta = computed(() => {
  if (props.delta === null || props.delta === undefined) return false;
  return props.showZeroDelta || props.delta !== 0;
});

// Format delta value
const formattedDelta = computed(() => {
  if (props.delta === null || props.delta === undefined) return "";

  const absValue = Math.abs(props.delta);

  if (props.deltaFormat) {
    const { type = "number", decimals = 0, currencyCode = "USD" } = props.deltaFormat;

    switch (type) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(absValue);
      case "percentage": {
        const formattedNumber = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(absValue);
        return `${formattedNumber}%`;
      }
      default:
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(absValue);
    }
  }

  const formatted = absValue.toFixed(props.format?.decimals ?? 0);

  return props.deltaAsPercentage ? `${formatted}%` : formatted;
});

// Format main value
const formattedValue = computed(() => {
  if (props.value === null || props.value === undefined) return null;

  if (typeof props.value === "string") return props.value;

  const { type = "number", decimals = 0, currencyCode = "USD" } = props.format || {};

  switch (type) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(props.value);
    case "percentage": {
      const formattedNumber = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(props.value);
      return `${formattedNumber}%`;
    }
    default:
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(props.value);
  }
});

// Size classes
const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return {
        value: "text-sm",
        delta: "text-xs",
        icon: 14,
      };
    case "lg":
      return {
        value: "text-lg font-semibold",
        delta: "text-sm",
        icon: 20,
      };
    default:
      return {
        value: "text-base",
        delta: "text-sm",
        icon: 16,
      };
  }
});
</script>

<template>
  <div class="delta-value flex flex-col">
    <!-- Main value (optional) -->
    <span
      v-if="formattedValue !== null"
      :class="sizeClasses.value"
      class="text-mainText"
    >
      {{ formattedValue }}
    </span>

    <!-- Delta row -->
    <div
      v-if="showDelta"
      :class="sizeClasses.delta"
      class="flex items-center gap-0.5"
    >
      <!-- Arrow icon -->
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

      <!-- Delta value -->
      <span
        :class="{
          'text-success': isPositive,
          'text-negative': isNegative,
          'text-secondaryText': isZero,
        }"
      >
        {{ formattedDelta }}
      </span>
    </div>
  </div>
</template>
