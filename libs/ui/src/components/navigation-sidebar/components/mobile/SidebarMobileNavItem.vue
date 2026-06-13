<script lang="ts" setup>
import { computed } from "vue";

import type { RouteLocationRaw } from "vue-router";

import VIcon from "../../../base/VIcon.vue";
import { useNavItemTo } from "../../composables/useNavItemTo";
import { useSidebarState } from "../../composables/useSidebarState";
import type { SidebarNavItem } from "../../types";

const { item, level = 0 } = defineProps<{
  item: SidebarNavItem
  level?: number
}>();

const {
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

const handleMouseEnter = (): void => {
  if (hasChildren.value || item.disabled || !resolvedTo.value) return;
  onPrefetch(resolvedTo.value as RouteLocationRaw);
};

const itemClasses = computed(() => ({
  "sidebar-item--active": isActive.value,
  "sidebar-item--has-active-child": hasActiveChild.value,
  "sidebar-item--disabled": item.disabled,
}));
</script>

<template>
  <div
    :style="`--depth: ${level}`"
    class="sidebar-item-wrapper"
  >
    <component
      :is="hasChildren || !item.to ? 'button' : 'router-link'"
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

      <span class="sidebar-item__label">{{ item.label }}</span>

      <span
        v-if="item.badge"
        class="sidebar-item__badge"
      >
        {{ item.badge }}
      </span>

      <VIcon
        v-if="hasChildren"
        :icon="isItemExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :size="16"
        class="sidebar-item__chevron"
      />
    </component>

    <!-- Children (accordion) -->
    <div
      v-if="hasChildren"
      :class="{ 'sidebar-item-children--expanded': isItemExpanded }"
      class="sidebar-item-children"
    >
      <div class="sidebar-item-children__inner">
        <SidebarMobileNavItem
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
/* Remove browser default focus ring on router-link */
.sidebar-item:focus {
  outline: none;
}

.sidebar-item.router-link-active:focus,
.sidebar-item.router-link-exact-active:focus {
  outline: none;
}
</style>
