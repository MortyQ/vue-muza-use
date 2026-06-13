<script lang="ts" setup>
import { computed } from "vue";

import type { RouteLocationRaw } from "vue-router";

import VIcon from "../../base/VIcon.vue";
import VTooltip from "../../overlay/VTooltip.vue";
import { useNavItemTo } from "../composables/useNavItemTo";
import { useSidebarState } from "../composables/useSidebarState";
import type { SidebarNavItem } from "../types";

import SidebarMenuFlyout from "./SidebarMenuFlyout.vue";

const { item, level = 0 } = defineProps<{
  item: SidebarNavItem
  level?: number
}>();

const {
  isCollapsed,
  isExpanded,
  toggleExpanded,
  closeMobile,
  isActive: checkActive,
  isOnActivePath,
  onPrefetch,
  options,
} = useSidebarState();

const { resolvedTo } = useNavItemTo(item, options.persistentQueryParams);

const hasChildren = computed(() => !!item.children?.length);
const isItemExpanded = computed(() => hasChildren.value && isExpanded(item.id));
const isActive = computed(() => checkActive(item.id));
const hasActiveChild = computed(
  () => !isActive.value && hasChildren.value && isOnActivePath(item.id),
);

const handleMouseEnter = (): void => {
  if (hasChildren.value || item.disabled || !resolvedTo.value) return;
  onPrefetch(resolvedTo.value as RouteLocationRaw);
};

const handleClick = (): void => {
  if (item.disabled) return;
  if (item.onClick) {
    item.onClick();
    closeMobile();
    return;
  }
  if (hasChildren.value) {
    toggleExpanded(item.id);
  }
  else {
    closeMobile();
  }
};

const itemClasses = computed(() => ({
  "sidebar-item--active": isActive.value,
  "sidebar-item--has-active-child": hasActiveChild.value,
  "sidebar-item--disabled": item.disabled,
  "sidebar-item--collapsed": isCollapsed.value,
}));
</script>

<template>
  <div
    :style="`--depth: ${level}`"
    class="sidebar-item-wrapper"
  >
    <!-- Collapsed + has children → flyout menu -->
    <SidebarMenuFlyout
      v-if="isCollapsed && hasChildren && !item.disabled"
      :item="item"
    >
      <button
        :aria-label="item.label"
        :class="{ 'sidebar-item--active': isActive,
                  'sidebar-item--has-active-child': hasActiveChild }"
        class="sidebar-item sidebar-item--collapsed"
        type="button"
        @click="handleClick"
      >
        <VIcon
          v-if="item.icon"
          :icon="item.icon"
          :size="20"
          class="sidebar-item__icon"
        />
      </button>
    </SidebarMenuFlyout>

    <!-- Collapsed + no children → tooltip -->
    <VTooltip
      v-else-if="isCollapsed && !item.disabled"
      :delay="200"
      :text="item.label"
      placement="right"
    >
      <component
        :is="item.to ? 'router-link' : 'button'"
        :aria-label="item.label"
        :class="{ 'sidebar-item--active': isActive }"
        :disabled="item.disabled || undefined"
        :to="item.to ? resolvedTo : undefined"
        :type="!item.to ? 'button' : undefined"
        class="sidebar-item sidebar-item--collapsed"
        @click="handleClick"
        @mouseenter="handleMouseEnter"
      >
        <VIcon
          v-if="item.icon"
          :icon="item.icon"
          :size="20"
          class="sidebar-item__icon"
        />
      </component>
    </VTooltip>

    <!-- Expanded state -->
    <component
      :is="hasChildren || !item.to ? 'button' : 'router-link'"
      v-else
      :aria-current="isActive ? 'page' : undefined"
      :aria-expanded="hasChildren ? isItemExpanded : undefined"
      :aria-label="item.label"
      :class="itemClasses"
      :disabled="item.disabled || undefined"
      :to="!hasChildren && item.to ? resolvedTo : undefined"
      :type="hasChildren || !item.to ? 'button' : undefined"
      class="sidebar-item"
      @click="handleClick"
      @mouseenter="handleMouseEnter"
    >
      <VIcon
        v-if="item.icon"
        :icon="item.icon"
        :size="20"
        class="sidebar-item__icon"
      />

      <Transition
        enter-active-class="sidebar-label-enter-active"
        enter-from-class="sidebar-label-enter-from"
        enter-to-class="sidebar-label-enter-to"
        leave-active-class="sidebar-label-leave-active"
        leave-from-class="sidebar-label-leave-from"
        leave-to-class="sidebar-label-leave-to"
      >
        <span
          v-if="!isCollapsed"
          class="sidebar-item__label"
        >{{ item.label }}</span>
      </Transition>

      <span
        v-if="item.badge && !isCollapsed"
        class="sidebar-item__badge"
      >
        {{ item.badge }}
      </span>

      <VIcon
        v-if="hasChildren && !isCollapsed"
        :icon="isItemExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :size="16"
        class="sidebar-item__chevron"
      />
    </component>

    <!-- Children (accordion) -->
    <div
      v-if="hasChildren && !isCollapsed"
      :class="{ 'sidebar-item-children--expanded': isItemExpanded }"
      class="sidebar-item-children"
    >
      <div class="sidebar-item-children__inner">
        <SidebarNavItem
          v-for="(child, idx) in item.children"
          :key="child.id"
          :item="child"
          :level="level + 1"
          :style="{ transitionDelay: isItemExpanded ? `${idx * 30}ms` : '0ms' }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Label fade transition */
.sidebar-label-enter-active {
  transition: opacity 200ms ease;
}

.sidebar-label-enter-from {
  opacity: 0;
}

.sidebar-label-enter-to {
  opacity: 1;
}

.sidebar-label-leave-active {
  transition: opacity 150ms ease;
}

.sidebar-label-leave-from {
  opacity: 1;
}

.sidebar-label-leave-to {
  opacity: 0;
}

/* Remove browser default focus ring on router-link */
.sidebar-item:focus {
  outline: none;
}

.sidebar-item.router-link-active:focus,
.sidebar-item.router-link-exact-active:focus {
  outline: none;
}
</style>
