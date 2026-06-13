<script lang="ts" setup>
import { computed } from "vue";

import { VIcon } from "../../../index";
import { formatNumber } from "../../../utils/formatters";

interface Props {
  page: number // Current page (1-based)
  pageSize: number // Items per page
  total: number // Total items
  pageSizeOptions?: number[] // Available page sizes
  showSizeChanger?: boolean // Show page size selector
  loading?: boolean // Loading state (disables all controls)
}

interface Emits {

  (e: "page-change", payload: { page: number, pageSize: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 25, 50, 100],
  showSizeChanger: false,
  loading: false,
});

const emit = defineEmits<Emits>();

// Computed values
const totalPages = computed(() => Math.ceil(props.total / props.pageSize));

const currentRangeStart = computed(() => {
  if (props.total === 0) return 0;
  return formatNumber((props.page - 1) * props.pageSize + 1);
});

const currentRangeEnd = computed(() => {
  const end = props.page * props.pageSize;
  return formatNumber(Math.min(end, props.total));
});

// Determine which page numbers to show
const visiblePages = computed(() => {
  const pages: (number | "ellipsis")[] = [];
  const total = totalPages.value;
  const current = props.page;

  if (total <= 7) {
    // Show all pages if 7 or less
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Always show first page
  pages.push(1);

  if (current <= 3) {
    // Near the beginning: 1, 2, 3, 4, ..., last
    pages.push(2, 3, 4);
    pages.push("ellipsis");
    pages.push(total);
  }
  else if (current >= total - 2) {
    // Near the end: 1, ..., last-3, last-2, last-1, last
    pages.push("ellipsis");
    pages.push(total - 3, total - 2, total - 1, total);
  }
  else {
    // Middle: 1, ..., current-1, current, current+1, ..., last
    pages.push("ellipsis");
    pages.push(current - 1, current, current + 1);
    pages.push("ellipsis");
    pages.push(total);
  }

  return pages;
});

// Handlers
const goToPage = (page: number) => {
  if (props.loading) return; // Prevent clicks during loading
  if (page === props.page) return; // Same page
  if (page < 1 || page > totalPages.value) return; // Invalid page

  emit("page-change", { page, pageSize: props.pageSize });
};

const goToPreviousPage = () => {
  if (props.page > 1) {
    goToPage(props.page - 1);
  }
};

const goToNextPage = () => {
  if (props.page < totalPages.value) {
    goToPage(props.page + 1);
  }
};

const changePageSize = (newSize: number) => {
  if (props.loading) return; // Prevent changes during loading
  if (newSize === props.pageSize) return; // Same size

  // When changing page size, reset to page 1
  emit("page-change", { page: 1, pageSize: newSize });
};

// Computed for disabled states
const isPrevDisabled = computed(() => props.loading || props.page <= 1);
const isNextDisabled = computed(() => props.loading || props.page >= totalPages.value);
</script>

<template>
  <div class="v-table-pagination">
    <!-- Left: Info about displayed items -->
    <div class="v-table-pagination-info">
      Showing
      <span class="v-table-pagination-info-highlight">
        {{ currentRangeStart }}–{{ currentRangeEnd }}
      </span>
      of
      <span class="v-table-pagination-info-highlight">{{ formatNumber(total) }}</span>
    </div>

    <!-- Center: Page controls -->
    <div class="v-table-pagination-controls">
      <!-- Previous button -->
      <button
        :disabled="isPrevDisabled"
        aria-label="Previous page"
        class="v-table-pagination-btn"
        @click="goToPreviousPage"
      >
        <VIcon
          :size="18"
          icon="mdi:chevron-left"
        />
      </button>

      <!-- Page numbers -->
      <template
        v-for="(pageItem, index) in visiblePages"
        :key="index"
      >
        <button
          v-if="pageItem !== 'ellipsis'"
          :class="{ 'v-table-pagination-btn--active': pageItem === page }"
          :disabled="loading"
          class="v-table-pagination-btn"
          @click="goToPage(pageItem)"
        >
          {{ pageItem }}
        </button>
        <span
          v-else
          class="v-table-pagination-ellipsis"
        >
          ...
        </span>
      </template>

      <!-- Next button -->
      <button
        :disabled="isNextDisabled"
        aria-label="Next page"
        class="v-table-pagination-btn"
        @click="goToNextPage"
      >
        <VIcon
          :size="18"
          icon="mdi:chevron-right"
        />
      </button>
    </div>

    <!-- Right: Items per page selector -->
    <div
      v-if="showSizeChanger"
      class="v-table-pagination-size"
    >
      <label for="pagination-size">Rows:</label>
      <select
        id="pagination-size"
        :disabled="loading"
        :value="pageSize"
        @change="changePageSize(Number(($event.target as HTMLSelectElement).value))"
      >
        <option
          v-for="size in pageSizeOptions"
          :key="size"
          :value="size"
        >
          {{ size }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
/* Styles defined in assets/styles/_pagination.scss */
</style>
