<script lang="ts" setup>
import { VIcon } from "../../../index";

defineProps<{
  title?: string
  description?: string
  icon?: string
}>();
</script>

<template>
  <div class="v-table-empty-state">
    <div class="v-table-empty-state-content">
      <div
        v-if="icon"
        class="v-table-empty-state-icon"
      >
        <VIcon
          :icon="icon"
          :size="48"
        />
      </div>

      <h3
        v-if="title"
        class="v-table-empty-state-title"
      >
        {{ title }}
      </h3>

      <p
        v-if="description"
        class="v-table-empty-state-description"
      >
        {{ description }}
      </p>

      <!-- Custom content slot -->
      <div
        v-if="$slots.default"
        class="v-table-empty-state-slot"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.v-table-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
}

.v-table-empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  pointer-events: auto;
}

.v-table-empty-state-icon {
  color: color-mix(in oklch, var(--ui-primary) 40%, transparent);
}

.v-table-empty-state-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ui-primary);
  white-space: nowrap;
}

.v-table-empty-state-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ui-foreground-secondary);
  text-align: center;
  max-width: 400px;
}

.v-table-empty-state-slot {
  margin-top: 0.5rem;
}
</style>
