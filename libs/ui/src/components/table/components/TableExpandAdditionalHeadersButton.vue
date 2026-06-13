<script lang="ts" setup>
import { VIcon } from "../../../index";

interface Props {
  isExpanded: boolean
}

defineProps<Props>();

const emit = defineEmits<{
  click: []
}>();
</script>

<template>
  <button
    :class="{ 'is-expanded': isExpanded }"
    class="expand-button"
    type="button"
    @click.stop="emit('click')"
  >
    <VIcon
      :size="16"
      class="expand-icon"
      icon="lucide:chevron-right"
    />
  </button>
</template>

<style scoped>
.expand-button {
  /* Sizing & Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  flex-shrink: 0;

  /* Reset button styles */
  border: none;
  background: transparent;
  cursor: pointer;

  /* Modern rounded style */
  border-radius: 6px;

  /* Colors using Tailwind theme */
  @apply text-primary;

  /* Smooth transitions */
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  /* Hover state - subtle background with primary color */

  &:hover {
    @apply bg-primary/10;
  }

  /* Active state - micro interaction */

  &:active {
    transform: scale(0.92);
    @apply bg-primary/20;
  }

  /* Focus state - accessibility */

  &:focus-visible {
    @apply outline-2 outline-primary outline-offset-2;
  }
}

/* Icon rotation animation */
.expand-icon {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Expanded state - rotate chevron right → down (90deg) */
.expand-button.is-expanded .expand-icon {
  transform: rotate(180deg);
}
</style>
