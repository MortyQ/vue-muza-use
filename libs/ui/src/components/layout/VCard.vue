<script lang="ts" setup>
import { type VNode, computed } from "vue";

import VLoader from "../feedback/VLoader.vue";

export type CardSize = "fit" | "sm" | "md" | "lg" | "xl" | "full";
export type CardVariant = "default" | "elevated" | "outlined" | "ghost" | "translucent";
export type CardRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

type CardProps = {
  variant?: CardVariant
  size?: CardSize
  radius?: CardRadius
  padding?: CardPadding
  loading?: boolean
  as?: string
};

type CardSlots = {
  default?: () => VNode[]
  header?: () => VNode[]
  footer?: () => VNode[]
  loading?: () => VNode[]
};

const {
  variant = "default",
  size = "full",
  radius = "xl",
  padding = "sm",
  loading = false,
  as = "div",
} = defineProps<CardProps>();

const slots = defineSlots<CardSlots>();

const cardClasses = computed(() => [
  "v-card",
  `v-card--${variant}`,
  `v-card--${size}`,
  `v-card--radius-${radius}`,
  `v-card--padding-${padding}`,
  loading && "v-card--loading",
]);
</script>

<template>
  <component
    :is="as"
    :class="cardClasses"
  >
    <div
      v-if="loading"
      class="v-card__loading text-primary"
    >
      <slot name="loading">
        <VLoader />
      </slot>
    </div>

    <template v-else>
      <header
        v-if="slots.header"
        class="v-card__header"
      >
        <slot name="header" />
      </header>

      <div
        v-if="slots.default"
        class="v-card__content"
      >
        <slot />
      </div>

      <footer
        v-if="slots.footer"
        class="v-card__footer"
      >
        <slot name="footer" />
      </footer>
    </template>
  </component>
</template>

<style scoped>
@import "../../styles/components/layout/vcard.scss";
</style>
