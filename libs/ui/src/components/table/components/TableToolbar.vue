<script lang="ts" setup>
import { computed, inject, type Slot } from "vue";

import { VButton, VFloating, VInput } from "../../../index";
import type { ToolbarConfig } from "../types/toolbar";

interface Props {
  config?: ToolbarConfig
  search?: string
}

const props = withDefaults(defineProps<Props>(), {
  config: undefined,
  search: "",
});

const emit = defineEmits<Emits>();

const tableSlots = inject<{
  toolbarTitle?: Slot
  toolbarSearch?: Slot
  toolbarActions?: Slot
}>("tableSlots", {});

interface Emits {

  (e: "update:search", value: string): void

  (e: "refresh"): void

  (e: "reset-sort"): void

  (e: "export", format: string, selectedOnly?: boolean): void
}

// Local search model for v-model
const searchModel = computed({
  get: () => props.search,
  set: (value: string) => emit("update:search", value),
});

// Search configuration
const searchConfig = computed(() => {
  if (!props.config?.search) return null;
  if (typeof props.config.search === "boolean") {
    return { placeholder: "Search..." };
  }
  return props.config.search;
});

// Export configuration from toolbar.actions.export
const exportConfig = computed(() => {
  const exportAction = props.config?.actions?.export;

  // Disabled
  if (!exportAction || !exportAction) {
    return null;
  }

  // Full object configuration
  if (typeof exportAction === "object") {
    return {
      mode: exportAction.mode,
      formats: exportAction.formats || [],
      selectedOnly: exportAction.selectedOnly ?? false,
      loading: exportAction.loading ?? false,
    };
  }

  // Shorthand: 'single' or 'multi' string
  return {
    mode: exportAction,
    formats: [],
    selectedOnly: false,
    loading: false,
  };
});

// Check if export is enabled
const isExportEnabled = computed(() => exportConfig.value !== null);

// Check if export is loading
const isExportLoading = computed(() => exportConfig.value?.loading || false);

// Get export formats
const exportFormats = computed(() => exportConfig.value?.formats || []);

// Check if any format is loading
const isAnyFormatLoading = computed(() => {
  return exportFormats.value.some(format => format.loading);
});

// Export mode
const exportMode = computed(() => exportConfig.value?.mode);

// Handlers
const handleRefresh = () => {
  emit("refresh");
};

const handleResetSort = () => {
  emit("reset-sort");
};

const handleExport = (value: string | number) => {
  emit("export", String(value), exportConfig.value?.selectedOnly);
};

const handleSingleExport = () => {
  // Default format for single export
  emit("export", "csv", exportConfig.value?.selectedOnly);
};
</script>

<template>
  <div class="v-toolbar v-toolbar--split">
    <!-- Left section -->
    <div class="v-toolbar-split-left">
      <!-- Title section -->
      <component
        :is="tableSlots.toolbarTitle"
        v-if="tableSlots.toolbarTitle"
      />
      <slot
        v-else
        name="title"
      >
        <div v-if="config?.title">
          <h3 class="v-toolbar-title">
            {{ config.title }}
          </h3>
          <p
            v-if="config.subtitle"
            class="v-toolbar-subtitle"
          >
            {{ config.subtitle }}
          </p>
        </div>
      </slot>

      <!-- Search section -->
      <component
        :is="tableSlots.toolbarSearch"
        v-if="tableSlots.toolbarSearch"
      />
      <slot
        v-else
        name="search"
      >
        <div
          v-if="searchConfig"
          class="v-toolbar-search-split flex h-full items-center"
        >
          <span
            class="w-px h-5 mr-4"
          />
          <VInput
            v-model="searchModel"
            :name="searchConfig.placeholder"
            :placeholder="searchConfig.placeholder"
            class="min-w-[300px]"
            debounce
            type="search"
          />
        </div>
      </slot>
    </div>

    <!-- Right section - Actions -->
    <div class="v-toolbar-split-right">
      <component
        :is="tableSlots.toolbarActions"
        v-if="tableSlots.toolbarActions"
      />
      <slot
        v-else
        name="actions"
      />
      <!-- Refresh button -->
      <VButton
        v-if="config?.actions?.refresh"
        icon="lucide:refresh-cw"
        variant="link"
        @click="handleRefresh"
      />

      <!-- Reset sort button -->
      <VButton
        v-if="config?.actions?.resetSort"
        icon="lucide:arrow-up-down"
        text="Reset Sort"
        variant="link"
        @click="handleResetSort"
      />

      <!-- Single Export button -->
      <VButton
        v-if="isExportEnabled && exportMode === 'single'"
        :disabled="isExportLoading"
        :loading="isExportLoading"
        icon="lucide:file-down"
        text="Export"
        variant="primary"
        @click="handleSingleExport"
      />

      <!-- Multi Export dropdown -->
      <VFloating
        v-if="isExportEnabled && exportMode === 'multi'"
        :items="exportFormats"
        placement="bottom-right"
        @select="handleExport"
      >
        <template #trigger>
          <VButton
            :loading="isAnyFormatLoading"
            icon="lucide:file-down"
            text="Export"
            variant="primary"
          />
        </template>
      </VFloating>

      <!-- Column Setup slot -->
      <slot
        v-if="config?.actions?.columnSetup"
        name="column-setup"
      />
    </div>
  </div>
</template>
