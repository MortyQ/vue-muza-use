<script lang="ts" setup>
import { useSidebarState } from "../composables/useSidebarState";

import SidebarNavItem from "./SidebarNavItem.vue";

const {
  resolvedItems,
  isCollapsed,
  expandedItems,
  activeItemId,
} = useSidebarState();
</script>

<template>
  <nav
    :class="{ 'sidebar-nav--collapsed': isCollapsed }"
    class="sidebar-nav"
  >
    <div class="sidebar-nav__list">
      <!--
        v-memo: only primitive values — fixes broken array-in-array issue.
        Items re-render only when active route, expand state or collapse changes.
      -->
      <SidebarNavItem
        v-for="item in resolvedItems"
        :key="item.id"
        v-memo="[activeItemId, expandedItems.size, isCollapsed, item.id]"
        :item="item"
        :level="0"
      />
    </div>
  </nav>
</template>
