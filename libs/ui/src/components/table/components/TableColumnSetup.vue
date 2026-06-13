<script lang="ts" setup>
import { ref, computed, watch } from "vue";

import { VButton, VCheckbox, VIcon } from "../../../index";
import type { Column } from "../types";
import tableStorage from "../utils/storage";

interface ColumnSetupItem {
  key: string
  label: string
  visible: boolean
  order: number
  fixed?: "left" | "right"
}

interface ColumnSetupConfig {
  enabled?: boolean
  key?: string
  type?: "indexedDB" | "localStorage" | "sessionStorage"
  allowReorder?: boolean
  initialVisible?: string[]
}

interface Props {
  columns: Column[]
  config?: ColumnSetupConfig
}

interface Emits {

  (e: "update:visible-columns", columns: Column[]): void

  (e: "close"): void
}

const props = withDefaults(defineProps<Props>(), {
  config: () => ({}),
});

const emit = defineEmits<Emits>();

// Load saved state from storage (async)
const loadFromStorage = async (): Promise<{
  visible: string[]
  order: string[]
  fixed?: Record<string, "left" | "right">
} | null> => {
  if (!props.config?.key) return null;

  try {
    // Set storage type if specified, otherwise use default (indexedDB)
    if (props.config.type) {
      tableStorage.setStorageType(props.config.type);
    }

    const saved = await tableStorage.getTableConfig<{
      visible: string[]
      order: string[]
      fixed?: Record<string, "left" | "right">
    }>(props.config.key);

    return saved;
  }
  catch (error) {
    console.error("Failed to load column setup from storage:", error);
    return null;
  }
};

// Save state to storage (async)
const saveToStorage = async (setupItems: ColumnSetupItem[]) => {
  if (!props.config?.key) return;

  try {
    // Build fixed map (only save columns that are fixed)
    const fixed: Record<string, "left" | "right"> = {};
    setupItems.forEach((item) => {
      if (item.fixed) {
        fixed[item.key] = item.fixed;
      }
    });

    const state = {
      visible: setupItems.filter(item => item.visible).map(item => item.key),
      order: setupItems.map(item => item.key),
      fixed: Object.keys(fixed).length > 0 ? fixed : undefined, // Only save if there are fixed columns
    };

    await tableStorage.setTableConfig(props.config.key, state);
  }
  catch (error) {
    console.error("Failed to save column setup to storage:", error);
  }
};

// Flatten columns to handle grouped headers
const flattenColumns = (columns: Column[]): Column[] => {
  return columns.reduce((acc, col) => {
    if (col.children && col.children.length > 0) {
      return [...acc, ...flattenColumns(col.children)];
    }
    return [...acc, col];
  }, [] as Column[]);
};

// Create setup items from columns
const createSetupItems = (savedState?: {
  visible: string[]
  order: string[]
  fixed?: Record<string, "left" | "right">
} | null): ColumnSetupItem[] => {
  const flatCols = flattenColumns(props.columns);

  // If we have saved state, use it
  if (savedState) {
    const { visible, order, fixed: savedFixed } = savedState;

    // Create a map for quick lookup
    const colMap = new Map(flatCols.map(col => [col.key, col]));

    // Build items based on saved order
    const setupItems: ColumnSetupItem[] = [];

    // First, add columns in saved order
    order.forEach((key, index) => {
      const col = colMap.get(key);
      if (col) {
        setupItems.push({
          key: col.key,
          label: col.label,
          visible: visible.includes(key),
          order: index,
          fixed: savedFixed?.[key] || col.fixed, // Use saved fixed state, fallback to column's fixed
        });
        colMap.delete(key);
      }
    });

    // Then add any new columns that weren't in saved state
    colMap.forEach((col) => {
      setupItems.push({
        key: col.key,
        label: col.label,
        visible: true,
        order: setupItems.length,
        fixed: col.fixed,
      });
    });

    return setupItems;
  }

  // No saved state, use initial config or show all columns by default
  const initialVisible = props.config?.initialVisible;

  return flatCols.map((col, index) => ({
    key: col.key,
    label: col.label,
    // If initialVisible is provided, check if column is in the list
    // If not provided, all columns are visible by default
    visible: initialVisible ? initialVisible.includes(col.key) : true,
    order: index,
    fixed: col.fixed,
  }));
};

// Internal state
const items = ref<ColumnSetupItem[]>(createSetupItems());

// Track if changes were made
const hasChanges = ref(false);

// Original state for comparison
const originalItems = ref<ColumnSetupItem[]>(JSON.parse(JSON.stringify(createSetupItems())));

// Load from storage asynchronously
loadFromStorage().then((savedState) => {
  if (savedState) {
    const loaded = createSetupItems(savedState);
    items.value = loaded;
    originalItems.value = JSON.parse(JSON.stringify(loaded));
  }
});

// Check if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  return JSON.stringify(items.value) !== JSON.stringify(originalItems.value);
});

// Emit visible columns to parent
const emitVisibleColumns = () => {
  const flatCols = flattenColumns(props.columns);
  const visibleItems = items.value.filter(item => item.visible).sort((a, b) => a.order - b.order);

  const visibleCols = visibleItems
    .map((item) => {
      const col = flatCols.find(c => c.key === item.key);
      if (!col) return null;

      // Apply fixed state from item to column
      return {
        ...col,
        fixed: item.fixed,
      };
    })
    .filter(Boolean) as Column[];

  emit("update:visible-columns", visibleCols);
};

// Watch for changes to track modifications (but don't emit)
watch(
  items,
  () => {
    hasChanges.value = true;
  },
  { deep: true },
);

// Apply changes handler
const handleApply = () => {
  saveToStorage(items.value);
  emitVisibleColumns();
  originalItems.value = JSON.parse(JSON.stringify(items.value));
  hasChanges.value = false;
  emit("close");
};

// Check if all visible or all hidden
const allVisible = computed(() => items.value.every(item => item.visible));
const allHidden = computed(() => items.value.every(item => !item.visible));
const someVisible = computed(() => !allVisible.value && !allHidden.value);

// Drag state
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const listRef = ref<HTMLElement | null>(null);
const autoScrollInterval = ref<number | null>(null);

// Auto-scroll when dragging near edges
const handleAutoScroll = (event: DragEvent) => {
  if (!listRef.value) return;

  const listRect = listRef.value.getBoundingClientRect();
  const mouseY = event.clientY;
  const scrollThreshold = 50; // pixels from edge to trigger scroll
  const scrollSpeed = 10; // pixels per interval

  // Check if near top edge
  if (mouseY < listRect.top + scrollThreshold && mouseY > listRect.top) {
    if (!autoScrollInterval.value) {
      autoScrollInterval.value = window.setInterval(() => {
        if (listRef.value && listRef.value.scrollTop > 0) {
          listRef.value.scrollTop -= scrollSpeed;
        }
      }, 16); // ~60fps
    }
  }
  // Check if near bottom edge
  else if (mouseY > listRect.bottom - scrollThreshold && mouseY < listRect.bottom) {
    if (!autoScrollInterval.value) {
      autoScrollInterval.value = window.setInterval(() => {
        if (listRef.value) {
          const maxScroll = listRef.value.scrollHeight - listRef.value.clientHeight;
          if (listRef.value.scrollTop < maxScroll) {
            listRef.value.scrollTop += scrollSpeed;
          }
        }
      }, 16);
    }
  }
  // Stop auto-scroll if not near edges
  else {
    stopAutoScroll();
  }
};

const stopAutoScroll = () => {
  if (autoScrollInterval.value) {
    clearInterval(autoScrollInterval.value);
    autoScrollInterval.value = null;
  }
};

// Drag handlers
const handleDragStart = (index: number, event: DragEvent) => {
  if (props.config?.allowReorder === false) return;

  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/html", "");
  }
};

const handleDragOver = (index: number, event: DragEvent) => {
  if (props.config?.allowReorder === false) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOverIndex.value = index;

  // Trigger auto-scroll if near edges
  handleAutoScroll(event);
};

const handleDragLeave = () => {
  dragOverIndex.value = null;
};

const handleDrop = (toIndex: number, event: DragEvent) => {
  if (props.config?.allowReorder === false) return;

  event.preventDefault();
  stopAutoScroll(); // Stop auto-scroll on drop

  if (draggedIndex.value === null || draggedIndex.value === toIndex) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  // Reorder
  const newItems = [...items.value];
  const [movedItem] = newItems.splice(draggedIndex.value, 1);
  newItems.splice(toIndex, 0, movedItem);

  // Update order values
  newItems.forEach((item, index) => {
    item.order = index;
  });

  items.value = newItems;

  // Validate fixed columns after reorder
  validateFixedColumns();

  draggedIndex.value = null;
  dragOverIndex.value = null;
};

const handleDragEnd = () => {
  draggedIndex.value = null;
  dragOverIndex.value = null;
  stopAutoScroll();
};

// Toggle handlers
const handleToggle = (key: string) => {
  const item = items.value.find(item => item.key === key);
  if (item) {
    item.visible = !item.visible;
  }
};

const handleToggleAll = () => {
  const newValue = !allVisible.value;
  items.value.forEach((item) => {
    item.visible = newValue;
  });
};

// Fixed column handlers
const canBeFixed = (index: number): boolean => {
  // Only first 2 positions can be fixed
  return index === 0 || index === 1;
};

const isFixedLeft = (item: ColumnSetupItem): boolean => {
  return item.fixed === "left";
};

const toggleFixed = (index: number) => {
  if (!canBeFixed(index)) return;

  const item = items.value[index];
  if (!item) return;

  // Toggle fixed state
  if (item.fixed === "left") {
    item.fixed = undefined;
  }
  else {
    item.fixed = "left";
  }
};

// Validate fixed columns after reorder
const validateFixedColumns = () => {
  items.value.forEach((item, index) => {
    // If column is fixed but not in first 2 positions, remove fixed
    if (item.fixed === "left" && !canBeFixed(index)) {
      item.fixed = undefined;
    }
  });
};

const handleReset = async () => {
  // Clear storage on reset
  if (props.config?.key) {
    try {
      await tableStorage.deleteTableConfig(props.config.key);
    }
    catch (error) {
      console.error("Failed to clear storage:", error);
    }
  }
  items.value = createSetupItems();

  // Auto-apply reset changes
  emitVisibleColumns();
  originalItems.value = JSON.parse(JSON.stringify(items.value));
  hasChanges.value = false;

  // Close popover after reset
  emit("close");
};
</script>

<template>
  <div class="column-setup">
    <!-- Header with actions -->
    <div class="column-setup-header">
      <div class="column-setup-title">
        <VIcon
          icon="lucide:table-2"
          size="small"
          variant="link"
        />
        <span>Column Settings</span>
      </div>
      <VButton
        icon="mdi:refresh"
        size="small"
        variant="link"
        @click="handleReset"
      />
    </div>

    <!-- Toggle all checkbox -->
    <div class="column-setup-toggle-all">
      <VCheckbox
        :indeterminate="someVisible"
        :model-value="allVisible"
        label="Toggle All"
        @update:model-value="handleToggleAll"
      />
    </div>

    <!-- Column list with drag-and-drop -->
    <div
      ref="listRef"
      class="column-setup-list"
    >
      <div
        v-for="(item, index) in items"
        :key="item.key"
        :class="{
          'column-setup-item--dragging': draggedIndex === index,
          'column-setup-item--drag-over': dragOverIndex === index,
          'column-setup-item--fixed': item.fixed,
          'column-setup-item--no-reorder': config?.allowReorder === false,
        }"
        :draggable="config?.allowReorder !== false"
        class="column-setup-item"
        @dragend="handleDragEnd"
        @dragleave="handleDragLeave"
        @dragover="handleDragOver(index, $event)"
        @dragstart="handleDragStart(index, $event)"
        @drop="handleDrop(index, $event)"
      >
        <!-- Drag handle -->
        <div
          v-if="config?.allowReorder !== false"
          class="column-setup-item-drag"
        >
          <VIcon
            icon="mdi:drag-vertical"
            size="small"
          />
        </div>

        <!-- Checkbox -->
        <div class="column-setup-item-checkbox">
          <VCheckbox
            :model-value="item.visible"
            @update:model-value="handleToggle(item.key)"
          />
        </div>

        <!-- Label -->
        <div class="column-setup-item-label">
          {{ item.label }}
        </div>

        <!-- Fixed toggle button (only for first 2 positions) -->
        <button
          v-if="canBeFixed(index)"
          :class="{ 'column-setup-item-fixed-btn--active': isFixedLeft(item) }"
          :title="isFixedLeft(item) ? 'Unpin column' : 'Pin column to left'"
          class="column-setup-item-fixed-btn"
          @click.stop="toggleFixed(index)"
        >
          <VIcon
            :icon="isFixedLeft(item) ? 'mdi:pin' : 'mdi:pin-outline'"
            :size="16"
          />
        </button>

        <!-- Fixed indicator badge (when fixed but position > 1) -->
        <div
          v-if="item.fixed && !canBeFixed(index)"
          class="column-setup-item-badge column-setup-item-badge--warning"
          title="Fixed will be removed - move to top 2 positions"
        >
          <VIcon
            icon="mdi:alert"
            size="small"
          />
        </div>
      </div>
    </div>

    <!-- Footer with hint and apply button -->
    <div class="column-setup-footer">
      <span
        v-if="config?.allowReorder !== false"
        class="column-setup-hint"
      >
        <VIcon
          icon="mdi:information-outline"
          size="small"
        />
        Drag to reorder • Pin first 2 columns
      </span>

      <VButton
        :disabled="!hasUnsavedChanges"
        size="small"
        text="Apply Changes"
        variant="primary"
        @click="handleApply"
      />
    </div>
  </div>
</template>

<style lang="scss">
@use "../assets/styles/column-setup";
</style>
