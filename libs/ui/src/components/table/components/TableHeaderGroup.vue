<script lang="ts" setup>
import type { HeaderCell } from "../types";

interface Props {
  cell: HeaderCell
  groupWidth?: number
}

defineProps<Props>();
</script>

<template>
  <div
    :class="{
      'v-table-header-group--left': cell.column.align === 'left',
      'v-table-header-group--center': cell.column.align === 'center',
      'v-table-header-group--right': cell.column.align === 'right',
    }"
    class="v-table-header-group"
  >
    <span class="v-table-header-group-label">{{ cell.label }}</span>
  </div>
</template>
