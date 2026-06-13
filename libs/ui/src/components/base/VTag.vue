<script lang="ts" setup>
import { computed } from "vue";

import VIcon from "./VIcon.vue";

export type TagVariant = "solid" | "soft" | "outline" | "ghost";
export type TagColor = "primary" | "success" | "warning" | "error" | "info" | "neutral" | "gray";
export type TagSize = "xs" | "sm" | "md" | "lg";

interface Props {
  /** Text content of the tag */
  label?: string
  /** Visual variant */
  variant?: TagVariant
  /** Color scheme */
  color?: TagColor
  /** Size variant */
  size?: TagSize
  /** Icon to display (lucide format) */
  icon?: string
  /** Make tag rounded/pill shaped */
  rounded?: boolean
}

const {
  label = "",
  variant = "soft",
  color = "primary",
  size = "sm",
  icon = undefined,
  rounded = false,
} = defineProps<Props>();

const iconSize = computed(() => ({ xs: 12, sm: 14, md: 16, lg: 18 }[size]));

const sizeClass = computed(() => `vtag--${size}`);
const variantColorClass = computed(() => `vtag--${variant}-${color}`);
const roundedClass = computed(() => rounded ? "vtag--rounded" : "vtag--square");
</script>

<template>
  <span
    :class="[sizeClass, variantColorClass, roundedClass]"
    class="vtag"
  >
    <slot name="icon-left">
      <VIcon
        v-if="icon"
        :icon="icon"
        :size="iconSize"
      />
    </slot>

    <slot>{{ label }}</slot>

    <slot name="icon-right" />
  </span>
</template>

<style scoped>
@import "../../styles/components/base/vtag.scss";
</style>
