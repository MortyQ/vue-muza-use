<script lang="ts" setup>
import { VCheckbox } from "../../../index";
import type { CheckboxState } from "../types";

interface Props {
  state: CheckboxState
  disabled?: boolean
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: []
}>();

const handleToggle = () => {
  if (!props.disabled) {
    emit("toggle");
  }
};
</script>

<template>
  <div
    class="v-table-header-checkbox-cell"
    @click.stop
  >
    <VCheckbox
      :disabled="disabled"
      :indeterminate="state === 'indeterminate'"
      :model-value="state === 'checked'"
      @update:model-value="handleToggle"
    />
  </div>
</template>

<style scoped>
.v-table-header-checkbox-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 0.5rem; /* 14px 8px - match header padding */
  height: 48px; /* Match $table-header-height from variables */
  min-height: 48px;
  box-sizing: border-box;
  background: color-mix(in oklch, var(--ui-surface) 98%, var(--ui-foreground) 2%);
  border-bottom: 1px solid var(--ui-border);
  border-right: 1px solid var(--ui-border);
  position: sticky;
  top: 0;
  z-index: 3;
  font-weight: 600;
}

/* Fixed column support */
:deep(.v-table-fixed-column) .v-table-header-checkbox-cell {
  z-index: 4;
}
</style>
