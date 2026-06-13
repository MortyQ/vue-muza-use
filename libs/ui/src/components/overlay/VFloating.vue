<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";

import VIcon from "../base/VIcon.vue";

// Types
interface FloatingItem {
  label: string
  value: string | number
  icon?: string
  disabled?: boolean
  loading?: boolean
  active?: boolean
}

type Placement = "bottom-left" | "bottom-right" | "top-left" | "top-right";

interface Props {
  // Common props
  placement?: Placement
  teleport?: boolean
  closeOnClickOutside?: boolean
  offset?: number // gap between trigger & floating (default 8)

  // Dropdown-specific props
  items?: FloatingItem[]
  disabled?: boolean
  closeOnSelect?: boolean

  // Styling
  unstyled?: boolean // Remove default styles for custom content
  contentClass?: string // Additional classes for content wrapper
}

interface Emits {

  (e: "select", value: string | number): void
}

const {
  placement = "bottom-right",
  teleport = true,
  closeOnClickOutside = true,
  offset = 8,
  items = [] as FloatingItem[],
  disabled = false,
  closeOnSelect = true,
  unstyled = false,
  contentClass = "",
} = defineProps<Props>();

const emit = defineEmits<Emits>();

// State
const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const floatingRef = ref<HTMLElement | null>(null);
const floatingPosition = ref<{
  top: number
  left: number | undefined
  right: number | undefined
}>({ top: 0, left: 0, right: undefined });
const isPositioned = ref(false);

// Performance helpers
let pendingFrame = false;
let resizeObserver: ResizeObserver | null = null;

function scheduleUpdate() {
  if (!isOpen.value || !floatingRef.value) return;
  if (pendingFrame) return;
  pendingFrame = true;
  requestAnimationFrame(() => {
    pendingFrame = false;
    updatePosition();
  });
}

// Computed
const isDropdownMode = computed(() => items.length > 0);

const floatingClasses = computed(() => {
  const base: Record<string, boolean> = {
    "v-floating--bottom-left": placement === "bottom-left",
    "v-floating--bottom-right": placement === "bottom-right",
    "v-floating--top-left": placement === "top-left",
    "v-floating--top-right": placement === "top-right",
    "v-floating--teleported": teleport,
  };

  if (!unstyled) {
    return [
      base,
      {
        "v-floating--dropdown": isDropdownMode.value,
        "v-floating--popover": !isDropdownMode.value,
        "v-floating--styled": true,
      },
      contentClass || undefined,
    ];
  }

  return [
    base,
    { "v-floating--unstyled": true },
    contentClass || undefined,
  ];
});

// Adjust floatingStyles type
const floatingStyles = computed<Record<string, string | undefined>>(() => {
  // Non-teleport mode - relative positioning
  if (!teleport) {
    return {};
  }

  if (!isPositioned.value) {
    return {};
  }

  // Use fixed positioning with viewport coordinates
  return {
    position: "fixed",
    zIndex: "9999",
    top: `${floatingPosition.value.top}px`,
    left: floatingPosition.value.left !== undefined ? `${floatingPosition.value.left}px` : undefined,
    right: floatingPosition.value.right !== undefined ? `${floatingPosition.value.right}px` : undefined,
    // Prevent following scroll by using fixed positioning as-is
    // The dropdown will stay in place relative to viewport, not following the trigger
  };
});

// Calculate position - SIMPLIFIED
const updatePosition = () => {
  if (!triggerRef.value || !floatingRef.value) return;

  if (teleport) {
    const triggerRect = triggerRef.value.getBoundingClientRect();
    const width = floatingRef.value.offsetWidth;
    const height = floatingRef.value.offsetHeight;

    const [vert, horiz] = placement.split("-") as ["top" | "bottom", "left" | "right"];
    const gap = offset;

    // Calculate vertical position
    let top: number;
    if (vert === "bottom") {
      top = triggerRect.bottom + gap;
    }
    else {
      top = triggerRect.top - height - gap;
    }

    // Calculate horizontal position
    let left: number;
    if (horiz === "left") {
      left = triggerRect.left;
    }
    else {
      left = triggerRect.right - width;
    }

    floatingPosition.value.top = top;
    floatingPosition.value.left = left;
    floatingPosition.value.right = undefined;
  }
  else {
    // Non-teleport mode: use relative positioning (simpler, no calculations needed)
    // Position is handled by CSS - just mark as positioned
    floatingPosition.value.top = 0;
    floatingPosition.value.left = 0;
  }

  isPositioned.value = true;
};

// Toggle
const toggle = () => {
  if (disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    isPositioned.value = false;
    // Strategy: render → measure → position → show (Headless UI approach)
    nextTick(() => {
      if (floatingRef.value && triggerRef.value) {
        updatePosition();
        initAutoUpdate();
      }
    });
  }
  else {
    teardownAutoUpdate();
  }
};

// Close
const close = () => {
  if (!isOpen.value) return;
  isOpen.value = false;
  isPositioned.value = false;
  document.removeEventListener("keydown", handleKeyDown);
  teardownAutoUpdate();
};

// Open
const open = () => {
  if (disabled) return;
  if (isOpen.value) return;
  isOpen.value = true;
  isPositioned.value = false;
  document.addEventListener("keydown", handleKeyDown);
  nextTick(() => {
    if (floatingRef.value && triggerRef.value) {
      updatePosition();
      initAutoUpdate();
    }
  });
};

const handleItemClick = (item: FloatingItem) => {
  if (item.disabled || item.loading) return;

  emit("select", item.value);

  if (closeOnSelect && !item.loading) {
    close();
  }
};

// Escape key handling NEW
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && isOpen.value) close();
};

// Click outside handling (ensure mounted listener)
const handleClickOutside = (event: MouseEvent) => {
  if (!closeOnClickOutside || !isOpen.value) return;
  const target = event.target as Node;
  if (triggerRef.value && floatingRef.value
    && !triggerRef.value.contains(target)
    && !floatingRef.value.contains(target)) {
    close();
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
  teardownAutoUpdate();
});

// Smooth position update on scroll/resize (Floating UI approach)
const handleScroll = () => {
  if (!isOpen.value || !teleport) return;
  scheduleUpdate();
};

const handleResize = () => {
  if (!isOpen.value || !teleport) return;
  scheduleUpdate();
};

function initAutoUpdate() {
  if (!teleport) return;

  // Listen for scroll events (capture phase catches all scrollable elements)
  window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
  window.addEventListener("resize", handleResize, { passive: true });

  if (triggerRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleUpdate());
    resizeObserver.observe(triggerRef.value);
  }

  // Always listen for Escape key
  document.addEventListener("keydown", handleKeyDown);
}

function teardownAutoUpdate() {
  window.removeEventListener("scroll", handleScroll, { capture: true });
  window.removeEventListener("resize", handleResize);

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

// Expose
defineExpose({
  isOpen,
  open,
  close,
  toggle,
});
</script>

<template>
  <div class="v-floating">
    <div
      ref="triggerRef"
      :aria-expanded="isOpen"
      :aria-haspopup="isDropdownMode ? 'listbox' : 'dialog'"
      :class="{ 'v-floating-trigger--disabled': disabled }"
      class="v-floating-trigger"
      @click="toggle"
    >
      <slot
        :is-disabled="disabled"
        :is-open="isOpen"
        name="trigger"
      />
    </div>
    <Teleport
      :disabled="!teleport"
      to="body"
    >
      <div
        v-if="isOpen"
        ref="floatingRef"
        :class="[floatingClasses, { 'v-floating--positioning': !isPositioned }]"
        :role="isDropdownMode ? 'listbox' : 'dialog'"
        :style="floatingStyles"
        class="v-floating-content text-foreground"
      >
        <slot name="content">
          <template v-if="isDropdownMode">
            <button
              v-for="item in items"
              :key="item.value"
              :aria-disabled="item.disabled || item.loading"
              :aria-selected="item.active"
              :class="{
                'v-floating-item--loading': item.loading,
                'v-floating-item--active': item.active,
                'v-floating-item--disabled': item.disabled,
              }"
              :disabled="item.disabled || item.loading"
              class="v-floating-item"
              role="option"
              @click="handleItemClick(item)"
            >
              <slot
                :item="item"
                name="item-icon"
              >
                <span
                  v-if="item.icon"
                  class="v-floating-item-icon"
                >
                  <VIcon
                    :icon="item.icon"
                    :loading="item.loading"
                    :size="16"
                  />
                </span>
              </slot>
              <span class="v-floating-item-label">{{ item.label }}</span>
            </button>
          </template>
        </slot>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import "../../styles/components/overlay/vfloating.scss";
</style>
