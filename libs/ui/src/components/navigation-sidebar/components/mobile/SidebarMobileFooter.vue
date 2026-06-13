<script lang="ts" setup>
import type { SidebarNavItem } from "../../types";

import SidebarMobileNavItem from "./SidebarMobileNavItem.vue";

const { items = [] } = defineProps<{
  items?: SidebarNavItem[]
}>();
</script>

<template>
  <div class="sidebar-mobile-footer">
    <!--
      #start — e.g. <UserMenu class="w-full" />
    -->
    <div
      v-if="$slots.start"
      class="sidebar-mobile-footer__slot"
    >
      <slot name="start" />
    </div>

    <!-- Footer nav items -->
    <nav
      v-if="items.length"
      class="sidebar-mobile-footer__nav"
    >
      <SidebarMobileNavItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        :level="0"
      />
    </nav>

    <!--
      #end — e.g. <ThemeToggle class="w-full" show-label />
    -->
    <div
      v-if="$slots.end"
      class="sidebar-mobile-footer__slot"
    >
      <slot name="end" />
    </div>
  </div>
</template>
