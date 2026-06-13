<script lang="ts" setup>
import type { Column } from "../types";

import TableHeader from "./TableHeader.vue";

interface Props {
  columns: Column[]

  getColumnClasses: (_column: Column) => string[]

  getFixedStyles: (_column: Column) => Record<string, string>

  getSortState: (_columnKey: string) => {
    isSorted: boolean
    order: "asc" | "desc" | null
    index: number
  }

  isColumnResizable: (_column: Column) => boolean
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "resize-start": [columnKey: string, event: MouseEvent]
  "resize-dblclick": [columnKey: string]
  "sort-click": [column: Column]
}>();

const handleResizeStart = (columnKey: string, event: MouseEvent) => {
  emit("resize-start", columnKey, event);
};

const handleResizeDblClick = (columnKey: string) => {
  emit("resize-dblclick", columnKey);
};

const handleSortClick = (column: Column) => {
  emit("sort-click", column);
};
</script>

<template>
  <!-- Simple header - single level (original implementation) -->
  <div class="v-table-header-row">
    <!-- Checkbox column header (slot) -->
    <slot name="checkbox-header" />
    <TableHeader
      v-for="column in columns"
      :key="column.key"
      :align="column.align"
      :class="getColumnClasses(column)"
      :column="column"
      :column-key="column.key"
      :is-sorted="getSortState(column.key).isSorted"
      :label="column.label"
      :resizable="props.isColumnResizable(column)"
      :sort-index="getSortState(column.key).index"
      :sort-order="getSortState(column.key).order"
      :style="getFixedStyles(column)"
      @sort-click="handleSortClick(column)"
      @resize-start="handleResizeStart"
      @resize-dblclick="handleResizeDblClick"
    >
      <!-- Forward custom icon slot -->
      <template
        v-if="$slots[`header-icon-${column.key}`]"
        #icon="slotProps"
      >
        <slot
          :name="`header-icon-${column.key}`"
          v-bind="slotProps"
        />
      </template>

      <!-- Forward custom header slot -->
      <template
        v-if="$slots[`header-${column.key}`]"
        #default="slotProps"
      >
        <slot
          :name="`header-${column.key}`"
          v-bind="slotProps"
        />
      </template>
    </TableHeader>
  </div>
</template>
