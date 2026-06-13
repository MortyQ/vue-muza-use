<script lang="ts" setup>
/**
 * TableTitleBlock Component
 *
 * A header block for table sections with title and actions.
 * Used for toggle controls above tables.
 *
 * @example
 * ```vue
 * <TableTitleBlock title="Intraday Analytics">
 *   <VToggleGroup v-model="activeView" :options="viewOptions" />
 * </TableTitleBlock>
 * ```
 */
import { VIcon } from "../../../index";

interface Props {
  /** Block title */
  title?: string
  /** Optional icon (lucide icon name) */
  icon?: string
}

withDefaults(defineProps<Props>(), {
  title: "",
  icon: "",
});
</script>

<template>
  <div class="v-table-title-block">
    <div class="v-table-title-block__title-section">
      <VIcon
        v-if="icon"
        :icon="icon"
        :size="20"
        class="v-table-title-block__icon"
      />
      <h3
        v-if="title"
        class="v-table-title-block__title"
      >
        {{ title }}
      </h3>
      <!-- Separator -->
      <span
        v-if="title && $slots.default"
        class="v-table-title-block__separator"
      />
    </div>

    <!-- Default slot for actions (VToggleGroup, etc.) -->
    <div
      v-if="$slots.default"
      class="v-table-title-block__actions"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.v-table-title-block {
  container-type: inline-size;
  container-name: title-block;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;

  min-width: 0;
  flex-wrap: wrap;

  &__title-section {
    display: flex;
    align-items: center;
    gap: 0.625rem;

    flex: 0 1 auto;

    min-width: 0;
    max-width: 100%;
  }

  &__icon {
    @apply text-primary;
    flex-shrink: 0;
  }

  &__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-foreground);
    margin: 0;

    line-height: 1.3;
  }

  &__separator {
    width: 1px;
    height: 1.25rem;
    background: var(--ui-border);
    margin: 0 0.25rem;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: wrap;
  }
}

@container title-block (max-width: 500px) {
  .v-table-title-block {

    &__title-section {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    &__actions {
      width: 100%;
      justify-content: flex-start;
    }

    &__separator {
      display: none;
    }
  }
}
</style>
