<script lang="ts" setup>

import { useSidebarState } from "../composables/useSidebarState";
import type { SidebarNavItem as SidebarNavItemType } from "../types";

import SidebarNavItem from "./SidebarNavItem.vue";

const { items = [] } = defineProps<{
  /** Optional explicit footer nav items. When omitted, no nav is rendered. */
  items?: SidebarNavItemType[]
}>();

const { isCollapsed } = useSidebarState();

</script>

<template>
  <div
    :class="{ 'v-sidebar-footer--collapsed': isCollapsed }"
    class="v-sidebar-footer"
  >
    <!--
      #start — slot for content above nav items (e.g. user menu)
      App injects: <UserMenu :compact="isCollapsed" />
    -->
    <div
      v-if="$slots.start"
      class="v-sidebar-footer__slot"
    >
      <slot name="start" />
    </div>

    <!-- Footer nav items -->
    <nav
      v-if="items.length"
      class="v-sidebar-footer__nav"
    >
      <SidebarNavItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        :level="0"
      />
    </nav>

    <!--
      #end — slot for content below nav items (e.g. theme toggle)
      App injects: <ThemeToggle />
    -->
    <div
      v-if="$slots.end"
      class="sidebar-footer__slot"
    >
      <slot name="end" />
    </div>
  </div>
</template>
