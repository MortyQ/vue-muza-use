<script lang="ts" setup>
import { computed } from "vue";

import type { RouteLocationRaw } from "vue-router";

import VIcon from "../../base/VIcon.vue";
import { useNavItemTo } from "../composables/useNavItemTo";
import { useSidebarState } from "../composables/useSidebarState";
import type { SidebarNavItem } from "../types";

const { item } = defineProps<{
  item: SidebarNavItem & { level: number }
}>();

const emit = defineEmits<{
  click: [item: SidebarNavItem]
}>();

const { isActive, onPrefetch, options } = useSidebarState();
const { resolvedTo } = useNavItemTo(item, options.persistentQueryParams);

const itemIsActive = computed(() => isActive(item.id));

const itemClasses = computed(() => ({
  "sidebar-flyout__item--active": itemIsActive.value,
  "sidebar-flyout__item--disabled": item.disabled,
}));

const handleMouseEnter = (): void => {
  if (item.disabled || !resolvedTo.value) return;
  onPrefetch(resolvedTo.value as RouteLocationRaw);
};

const handleClick = (): void => {
  if (!item.disabled) {
    emit("click", item);
  }
};
</script>

<template>
  <router-link
    v-if="item.to"
    :aria-current="itemIsActive ? 'page' : undefined"
    :class="itemClasses"
    :style="`--depth: ${item.level}`"
    :to="resolvedTo as RouteLocationRaw"
    class="sidebar-flyout__item"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
  >
    <VIcon
      v-if="item.icon"
      :icon="item.icon"
      :size="16"
      class="sidebar-flyout__item-icon"
    />
    <span class="sidebar-flyout__item-label">{{ item.label }}</span>
    <span
      v-if="item.badge"
      class="sidebar-flyout__item-badge"
    >
      {{ item.badge }}
    </span>
  </router-link>
</template>
