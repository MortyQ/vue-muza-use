<script lang="ts" setup>
import { computed } from "vue";

import VIcon from "../base/VIcon.vue";

export interface SegmentOption {
  label: string
  value: string | number
  icon?: string
  disabled?: boolean
}

const {
  modelValue,
  options,
  size = "md",
  fullWidth = false,
  disabled = false,
} = defineProps<{
  modelValue: string | number
  options: SegmentOption[]
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
  disabled?: boolean
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number]
}>();

const iconSize = computed(() => ({ sm: 14, md: 16, lg: 20 }[size]));

const rootClass = computed(() => ({
  [`v-segmented-control--${size}`]: true,
  "v-segmented-control--full-width": fullWidth,
  "v-segmented-control--disabled": disabled,
}));

const getItemClass = (option: SegmentOption) => ({
  "v-sc__item--active": modelValue === option.value,
  "v-sc__item--disabled": !!option.disabled,
});

const handleSelect = (option: SegmentOption) => {
  if (option.disabled || disabled) return;
  emit("update:modelValue", option.value);
};
</script>

<template>
  <div
    :class="rootClass"
    class="v-segmented-control"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :aria-pressed="modelValue === option.value"
      :class="getItemClass(option)"
      :disabled="option.disabled || disabled"
      class="v-sc__item"
      type="button"
      @click="handleSelect(option)"
    >
      <VIcon
        v-if="option.icon"
        :icon="option.icon"
        :size="iconSize"
      />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
@import "../../styles/components/inputs/vsegmentedcontrol.scss";
</style>
