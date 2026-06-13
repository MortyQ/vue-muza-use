<script lang="ts" setup>
import { VCheckbox } from "../../../index";

interface Props {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
}

defineProps<Props>();

const emit = defineEmits<{
  toggle: []
}>();

const handleToggle = () => {
  emit("toggle");
};
</script>

<template>
  <div
    class="v-table-checkbox-cell"
    @click.stop
  >
    <VCheckbox
      :disabled="disabled"
      :indeterminate="indeterminate"
      :model-value="checked"
      @update:model-value="handleToggle"
    />
  </div>
</template>

<style scoped>
.v-table-checkbox-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem; /* 8px */
  border-right: 1px solid var(--ui-border);
}
</style>
