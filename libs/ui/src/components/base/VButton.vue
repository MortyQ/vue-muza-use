<script lang="ts" setup>
import { computed } from "vue";

import { type RouteLocationRaw, RouterLink } from "vue-router";

import VIcon from "./VIcon.vue";

const {
  text = "",
  type = "button",
  variant = "primary",
  icon = undefined,
  to = undefined,
  replace = false,
  disabled = false,
  loading = false,
} = defineProps<{
  text?: string
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  loading?: boolean
  icon?: string
  variant?: "primary" | "positive" | "negative" | "warning" | "link"
  to?: RouteLocationRaw
  replace?: boolean
}>();

const slots = defineSlots();

const isIconOnly = computed(() => !text && !!icon && !slots.default);
const isRouterLink = computed(() => !!to);
const isDisabled = computed(() => disabled || loading);

const variantClass = computed(() => `v-button--${variant}`);

const rootClass = computed(() => ({
  "v-button--icon-only": isIconOnly.value,
  [variantClass.value]: true,
  "v-button--disabled": isDisabled.value,
}));

const rootAttrs = computed(() => {
  if (isRouterLink.value) {
    return {
      to,
      replace,
      "aria-disabled": isDisabled.value || undefined,
      tabindex: isDisabled.value ? -1 : undefined,
    };
  }
  return {
    type,
    disabled: isDisabled.value,
    "aria-busy": loading || undefined,
  };
});
</script>

<template>
  <component
    :is="isRouterLink ? RouterLink : 'button'"
    :class="rootClass"
    class="v-button"
    v-bind="rootAttrs"
  >
    <span
      v-if="$slots.iconLeft || loading || icon"
      class="inline-flex items-center justify-center"
    >
      <slot name="iconLeft">
        <VIcon
          :icon="icon"
          :loading="loading"
          :size="24"
        />
      </slot>
    </span>

    <span
      v-if="!isIconOnly"
      class="inline-flex items-center justify-center gap-0.75"
    >
      <slot>{{ text }}</slot>
    </span>

    <span
      v-if="$slots.iconRight"
      class="inline-flex items-center justify-center"
    >
      <slot name="iconRight" />
    </span>
  </component>
</template>

<style>
@layer components {
  :where(.v-button) {
    width: fit-content;
  }
}
</style>

<style scoped>
@import "../../styles/components/base/vbutton.scss";
</style>
