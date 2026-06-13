<script lang="ts" setup>
import VIcon from "../../base/VIcon.vue";
import type { SidebarNavItem } from "../types";

const { item } = defineProps<{
  item: SidebarNavItem & { level: number }
}>();
</script>

<template>
  <div
    :style="`--depth: ${item.level}`"
    class="sidebar-flyout__item sidebar-flyout__item--parent"
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
  </div>
</template>
