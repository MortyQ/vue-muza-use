<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";

import Multiselect from "vue-multiselect";

import type { SelectOption } from "../../types/select";
import VIcon from "../base/VIcon.vue";

// Use a typed instance that exposes the root element for DOM queries.
type MultiselectInstance = InstanceType<typeof Multiselect> & { $el?: HTMLElement };

const {
  modelValue = null,
  options = [],
  placeholder = "Select option",
  disabled = false,
  multiple = false,
  searchable = true,
  clearOnSelect = true,
  closeOnSelect = true,
  label = "label",
  trackBy = "value",
  loading = false,
  taggable = false,
  maxHeight = 300,
  optionsLimit = 1000,
  teleportToBody = true,
  name = "",
  allowEmpty = false,
} = defineProps<{
  modelValue?: SelectOption | SelectOption[] | null
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  multiple?: boolean
  searchable?: boolean
  clearOnSelect?: boolean
  closeOnSelect?: boolean
  label?: string
  trackBy?: string
  loading?: boolean
  taggable?: boolean
  maxHeight?: number
  optionsLimit?: number
  teleportToBody?: boolean
  /** Floating label text — also used as aria label */
  name?: string
  allowEmpty?: boolean
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SelectOption | SelectOption[] | null]
  select: [option: SelectOption]
  remove: [option: SelectOption]
  "search-change": [query: string]
  open: []
  close: []
}>();

const isFocused = ref(false);

const hasValue = computed(() => {
  if (Array.isArray(modelValue)) return modelValue.length > 0;
  if (modelValue && typeof modelValue === "object") return true;
  return modelValue !== null && modelValue !== undefined;
});

// Hide placeholder when floating label is present and not focused (avoids duplication)
const computedPlaceholder = computed(() => {
  if (!name) return placeholder;
  return isFocused.value ? placeholder : "";
});

const handleInput = (value: SelectOption | SelectOption[] | null) => emit("update:modelValue", value);
const handleSelect = (option: SelectOption) => emit("select", option);
const handleRemove = (option: SelectOption) => emit("remove", option);
const handleSearchChange = (query: string) => emit("search-change", query);

// ── Floating dropdown (teleport to body) ──────────────────────────────────
const msRef = ref<MultiselectInstance | null>(null);
let dropdownEl: HTMLElement | null = null;
let placeholderNode: Comment | null = null;
let originalParent: HTMLElement | null = null;

const updatePosition = () => {
  if (!dropdownEl || !msRef.value) return;

  const trigger = msRef.value.$el?.querySelector(".multiselect__tags") as HTMLElement | null;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const dropdownHeight = Math.min(dropdownEl.scrollHeight, maxHeight);
  const openAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow;

  const top = openAbove
    ? Math.max(4, rect.top - dropdownHeight - 4)
    : Math.min(window.innerHeight - dropdownHeight - 4, rect.bottom + 4);

  Object.assign(dropdownEl.style, {
    position: "fixed",
    top: `${top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: "10000",
  });

  dropdownEl.classList.toggle("opened-above", openAbove);
};

const handleScroll = () => requestAnimationFrame(updatePosition);

const enableFloating = () => {
  if (!teleportToBody) return;

  nextTick(() => {
    dropdownEl = msRef.value?.$el?.querySelector(".multiselect__content-wrapper") as HTMLElement | null;
    if (!dropdownEl) return;

    if (!placeholderNode) {
      originalParent = dropdownEl.parentElement;
      placeholderNode = document.createComment("v-multiselect-anchor");
      originalParent?.replaceChild(placeholderNode, dropdownEl);
      document.body.appendChild(dropdownEl);
    }

    dropdownEl.classList.add("v-ms-floating");
    updatePosition();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
  });
};

const disableFloating = () => {
  if (!dropdownEl) return;

  window.removeEventListener("scroll", handleScroll);
  window.removeEventListener("resize", handleScroll);

  dropdownEl.classList.remove("v-ms-floating", "opened-above");
  dropdownEl.removeAttribute("style");

  if (placeholderNode && originalParent) {
    originalParent.replaceChild(dropdownEl, placeholderNode);
  }

  placeholderNode = null;
  originalParent = null;
  dropdownEl = null;
};

const handleOpen = () => {
  enableFloating();
  isFocused.value = true;
  emit("open");
};

const handleClose = () => {
  disableFloating();
  isFocused.value = false;
  emit("close");
};

onBeforeUnmount(() => disableFloating());
</script>

<template>
  <div
    class="v-select"
    :class="{ 'v-select--disabled': disabled }"
  >
    <!-- Floating label -->
    <label
      v-if="name"
      :class="{ 'v-select__label--active': isFocused || hasValue }"
      class="v-select__label"
    >
      {{ name }}
    </label>

    <!-- Multiselect input -->
    <Multiselect
      ref="msRef"
      :allow-empty="allowEmpty"
      :clear-on-select="clearOnSelect"
      :close-on-select="closeOnSelect"
      :disabled="disabled"
      :label="label"
      :loading="loading"
      :max-height="maxHeight"
      :model-value="modelValue"
      :multiple="multiple"
      :options="(options as any[])"
      :options-limit="optionsLimit"
      :placeholder="computedPlaceholder"
      :searchable="searchable"
      :show-labels="false"
      :taggable="taggable"
      :track-by="trackBy"
      v-bind="$attrs"
      @close="handleClose"
      @open="handleOpen"
      @remove="handleRemove"
      @select="handleSelect"
      @update:model-value="handleInput"
      @search-change="handleSearchChange"
    >
      <!-- Custom caret / loader -->
      <template #caret>
        <div class="multiselect__select">
          <VIcon
            :loading="loading"
            class="v-select__caret-icon"
            icon="mdi:chevron-down"
          />
        </div>
      </template>

      <!-- Forward any provided slots -->
      <template
        v-for="(_, slotName) in $slots"
        :key="slotName"
        #[slotName]="slotProps"
      >
        <slot
          :name="slotName"
          v-bind="slotProps ?? {}"
        />
      </template>
    </Multiselect>

    <!-- Fieldset border (visual only) -->
    <fieldset
      :class="{ 'v-select__fieldset--active': isFocused }"
      aria-hidden="true"
      class="v-select__fieldset"
    >
      <legend
        :class="{ 'v-select__legend--visible': name && (hasValue || isFocused) }"
        class="v-select__legend"
      >
        <span>{{ name }}</span>
      </legend>
    </fieldset>
  </div>
</template>

<!-- vue-multiselect base reset -->
<style src="vue-multiselect/dist/vue-multiselect.css"></style>

<!--
  Global styles for the teleported floating dropdown (.v-ms-floating).
  These must be unscoped — the content-wrapper is appended to <body>
  and falls outside the component's scoped DOM tree.
-->
<style>
/* Disable vue-multiselect's built-in open/close animation */
.multiselect-enter-active,
.multiselect-leave-active {
  transition: none !important;
}

/* ── Floating dropdown container ───────────────────────────────────────── */
.multiselect__content-wrapper.v-ms-floating {
  background-color: var(--ui-input-bg);
  border: 1px solid var(--ui-border-subtle);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-lg);
  box-sizing: border-box;
  position: fixed;
  margin: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-top: none;
  z-index: 10000 !important;
}

.multiselect__content-wrapper.v-ms-floating.opened-above {
  border-top: 1px solid var(--ui-border-subtle);
  border-bottom: none;
}

.multiselect__content-wrapper.v-ms-floating .multiselect__content {
  list-style: none;
  padding: 0;
  margin: 0;
  min-width: 100%;
  background: transparent;
}

/* ── Options ────────────────────────────────────────────────────────────── */
.multiselect__content-wrapper.v-ms-floating .multiselect__option {
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  color: var(--ui-foreground);
  font-weight: 400;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
  background: transparent;
}

.multiselect__content-wrapper.v-ms-floating .multiselect__option:hover,
.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--highlight {
  background-color: var(--ui-surface-hover);
  color: var(--ui-foreground);
}

.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--selected {
  background-color: var(--ui-primary);
  color: white;
  font-weight: 500;
}

.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--selected,
.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--selected * {
  color: white !important;
}

/* Hovering a selected item = deselect indicator */
.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--selected.multiselect__option--highlight {
  background-color: var(--ui-danger-subtle);
  color: var(--ui-danger);
}

.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--selected.multiselect__option--highlight,
.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--selected.multiselect__option--highlight * {
  color: var(--ui-danger) !important;
}

/* ── Grouped options ────────────────────────────────────────────────────── */
.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--group {
  background-color: var(--ui-surface-sunken);
  color: var(--ui-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
}

.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--group:hover,
.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--group.multiselect__option--highlight {
  background-color: var(--ui-border-subtle);
  color: var(--ui-primary);
}

.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--group.multiselect__option--selected {
  background-color: color-mix(in oklch, var(--ui-primary) 10%, transparent);
  color: var(--ui-primary);
}

.multiselect__tag-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.multiselect__tag-icon::after {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px !important;
  text-align: center;
  margin-bottom: 2px;
  margin-left: .5px;
}

/* ── Disabled options ───────────────────────────────────────────────────── */
.multiselect__content-wrapper.v-ms-floating .multiselect__option.multiselect__option--disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* ── Remove vue-multiselect's "Press enter to..." labels ────────────────── */
.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--highlight::after,
.multiselect__content-wrapper.v-ms-floating
.multiselect__option.multiselect__option--selected::after {
  content: none !important;
}
</style>

<style scoped>
@import "../../styles/components/inputs/vselect.scss";
</style>
