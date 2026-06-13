<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";

import { useTimeoutFn, useWindowSize } from "@vueuse/core";

import { useSidebarState } from "../composables/useSidebarState";
import type { SidebarNavItem } from "../types";

import SidebarMenuFlyoutItem from "./SidebarMenuFlyoutItem.vue";
import SidebarMenuFlyoutParent from "./SidebarMenuFlyoutParent.vue";

const { item } = defineProps<{
  item: SidebarNavItem
}>();

const { closeMobile } = useSidebarState();

const isOpen = ref(false);
const buttonRef = ref<HTMLElement | null>(null);
const flyoutRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ top: 0, left: 0, right: 0 });
const showOnLeft = ref(false);

const { width: viewportWidth } = useWindowSize();

const checkPosition = (): void => {
  if (!buttonRef.value || !flyoutRef.value) return;

  const btnRect = buttonRef.value.getBoundingClientRect();
  const menuRect = flyoutRef.value.getBoundingClientRect();
  const leftPos = btnRect.right + 8;

  if (leftPos + menuRect.width > viewportWidth.value - 20) {
    showOnLeft.value = true;
    menuPosition.value = {
      top: btnRect.top,
      right: viewportWidth.value - btnRect.left + 8,
      left: 0,
    };
  }
  else {
    showOnLeft.value = false;
    menuPosition.value = { top: btnRect.top, left: leftPos, right: 0 };
  }
};

watch(viewportWidth, () => {
  if (isOpen.value) checkPosition();
});

// useTimeoutFn auto-cleans up on component unmount — no manual onUnmounted needed
const { start: scheduleOpen, stop: cancelOpen } = useTimeoutFn(async () => {
  isOpen.value = true;
  await nextTick();
  requestAnimationFrame(checkPosition);
}, 150, { immediate: false });

const { start: scheduleClose, stop: cancelClose } = useTimeoutFn(() => {
  isOpen.value = false;
}, 100, { immediate: false });

const showMenu = (): void => {
  cancelClose();
  if (isOpen.value) return;

  // Pre-position before opening to prevent initial jump
  if (buttonRef.value) {
    const btnRect = buttonRef.value.getBoundingClientRect();
    menuPosition.value = { top: btnRect.top, left: btnRect.right + 8, right: 0 };
  }
  scheduleOpen();
};

const hideMenu = (): void => {
  cancelOpen();
  scheduleClose();
};

const allChildren = computed(() => {
  const flatten = (
    items: SidebarNavItem[],
    level = 0,
  ): Array<SidebarNavItem & { level: number }> => {
    const result: Array<SidebarNavItem & { level: number }> = [];
    for (const child of items) {
      result.push({ ...child, level });
      if (child.children?.length) {
        result.push(...flatten(child.children, level + 1));
      }
    }
    return result;
  };

  return item.children ? flatten(item.children) : [];
});

const handleLinkClick = (child: SidebarNavItem): void => {
  if (!child.disabled) {
    closeMobile();
    isOpen.value = false;
  }
};
</script>

<template>
  <div
    ref="buttonRef"
    class="sidebar-flyout-trigger"
    @mouseenter="showMenu"
    @mouseleave="hideMenu"
  >
    <slot />

    <Teleport to="body">
      <Transition
        enter-active-class="sidebar-flyout-enter-active"
        enter-from-class="sidebar-flyout-enter-from"
        enter-to-class="sidebar-flyout-enter-to"
        leave-active-class="sidebar-flyout-leave-active"
        leave-from-class="sidebar-flyout-leave-from"
        leave-to-class="sidebar-flyout-leave-to"
      >
        <div
          v-if="isOpen && item.children?.length"
          :style="{
            top: `${menuPosition.top}px`,
            ...(showOnLeft
              ? { right: `${menuPosition.right - 8}px` }
              : { left: `${menuPosition.left - 8}px` }),
          }"
          class="sidebar-flyout-portal"
          @mouseenter="showMenu"
          @mouseleave="hideMenu"
        >
          <!-- Invisible hover bridge prevents flicker when moving mouse to menu -->
          <div
            :class="showOnLeft ? 'sidebar-flyout-bridge--left' : 'sidebar-flyout-bridge--right'"
            class="sidebar-flyout-bridge"
          />

          <div
            ref="flyoutRef"
            class="sidebar-flyout-content"
          >
            <div class="sidebar-flyout">
              <div class="sidebar-flyout__title">
                {{ item.label }}
              </div>
              <div class="sidebar-flyout__list">
                <template
                  v-for="child in allChildren"
                  :key="child.id"
                >
                  <SidebarMenuFlyoutItem
                    v-if="child.to"
                    :item="child"
                    @click="handleLinkClick"
                  />
                  <SidebarMenuFlyoutParent
                    v-else
                    :item="child"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sidebar-flyout-trigger {
  position: relative;
}

.sidebar-flyout-portal {
  position: fixed;
  z-index: 100;
}

/* Hover bridge: invisible area connecting button to menu */
.sidebar-flyout-bridge {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1.5rem;
}

.sidebar-flyout-bridge--right {
  right: 100%;
  margin-right: -1rem;
}

.sidebar-flyout-bridge--left {
  left: 100%;
  margin-left: -1rem;
}

.sidebar-flyout-content {
  position: relative;
  margin-left: 0.5rem;
  /* WebKit: GPU compositing for smooth flyout animation */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
}

/* Transition classes */
.sidebar-flyout-enter-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.sidebar-flyout-enter-from {
  opacity: 0;
  transform: scale(0.95) translateX(-4px);
}

.sidebar-flyout-enter-to {
  opacity: 1;
  transform: scale(1) translateX(0);
}

.sidebar-flyout-leave-active {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}

.sidebar-flyout-leave-from {
  opacity: 1;
  transform: scale(1) translateX(0);
}

.sidebar-flyout-leave-to {
  opacity: 0;
  transform: scale(0.95) translateX(-4px);
}
</style>
