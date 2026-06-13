<script lang="ts" setup>
import type { Column, HeaderCell } from "../types";

import TableHeader from "./TableHeader.vue";
import TableHeaderGroup from "./TableHeaderGroup.vue";

interface Props {
  columns: HeaderCell[][] // Multi-level header structure

  getColumnClasses: (_column: Column) => string[]

  getFixedStyles: (_column: Column) => Record<string, string>

  getGroupWidth: (_column: Column) => number

  getGroupFixedStyles: (_column: Column) => Record<string, string>

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
  <!-- Grouped headers - multi-level support -->
  <div
    v-for="(level, levelIndex) in columns"
    :key="`header-level-${levelIndex}`"
    :class="`v-table-header-row-level-${levelIndex}`"
    class="v-table-header-row"
  >
    <!-- Checkbox column header (slot) - only in first level -->
    <slot
      v-if="levelIndex === 0"
      name="checkbox-header"
    />

    <!-- Render cells in this level -->
    <template
      v-for="cell in level"
      :key="cell.key"
    >
      <!-- Group header (has children) - no sorting -->
      <TableHeaderGroup
        v-if="cell.isGroup"
        :cell="cell"
        :class="getColumnClasses(cell.column)"
        :group-width="getGroupWidth(cell.column)"
        :style="{
          gridColumn: `span ${cell.colspan}`,
          gridRow: cell.rowspan > 1 ? `span ${cell.rowspan}` : undefined,
          ...getGroupFixedStyles(cell.column),
        }"
      />

      <!-- Leaf header (no children) - with sorting and resize -->
      <TableHeader
        v-else
        :align="cell.column.align"
        :class="[
          getColumnClasses(cell.column),
          {
            'v-table-header-cell--grouped': levelIndex > 0,
            'v-table-header-cell--rowspan': cell.rowspan > 1
          }
        ]"
        :column="cell.column"
        :column-key="cell.column.key"
        :is-sorted="getSortState(cell.column.key).isSorted"
        :label="cell.label"
        :resizable="props.isColumnResizable(cell.column)"
        :sort-index="getSortState(cell.column.key).index"
        :sort-order="getSortState(cell.column.key).order"
        :style="{
          gridRow: cell.rowspan > 1 ? `span ${cell.rowspan}` : undefined,
          ...getFixedStyles(cell.column),
        }"
        @sort-click="handleSortClick(cell.column)"
        @resize-start="handleResizeStart"
        @resize-dblclick="handleResizeDblClick"
      >
        <!-- Forward custom icon slot -->
        <template
          v-if="$slots[`header-icon-${cell.column.key}`]"
          #icon="slotProps"
        >
          <slot
            :name="`header-icon-${cell.column.key}`"
            v-bind="slotProps"
          />
        </template>

        <!-- Forward custom header slot -->
        <template
          v-if="$slots[`header-${cell.column.key}`]"
          #default="slotProps"
        >
          <slot
            :name="`header-${cell.column.key}`"
            v-bind="slotProps"
          />
        </template>
      </TableHeader>
    </template>
  </div>
</template>
