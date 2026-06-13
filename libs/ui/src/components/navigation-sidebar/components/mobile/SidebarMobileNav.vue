<script lang="ts" setup>
import { useSidebarState } from "../../composables/useSidebarState";

import SidebarMobileNavItem from "./SidebarMobileNavItem.vue";

const { resolvedItems, expandedItems, activeItemId } = useSidebarState();
</script>

<template>
  <nav
    aria-label="Mobile navigation"
    class="sidebar-mobile-nav"
  >
    <SidebarMobileNavItem
      v-for="item in resolvedItems"
      :key="item.id"
      v-memo="[activeItemId, expandedItems.size, item.id]"
      :item="item"
      :level="0"
    />
  </nav>
</template>
