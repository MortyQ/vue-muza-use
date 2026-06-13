<script lang="ts" setup>
import { computed, defineAsyncComponent, provide } from "vue";

import type { RouteLocationRaw } from "vue-router";

import SidebarFooter from "./components/SidebarFooter.vue";
import SidebarHeader from "./components/SidebarHeader.vue";
import SidebarNav from "./components/SidebarNav.vue";
import { SIDEBAR_STATE_KEY } from "./composables/injectionKeys";
import { useNavigation } from "./composables/useNavigation";
import { buildSidebarState } from "./composables/useSidebarState";
import type { SidebarInstance, SidebarNavItem } from "./types";

const { sidebar } = defineProps<{
  /** Sidebar instance created via createSidebar() */
  sidebar: SidebarInstance
}>();

const emit = defineEmits<{
  /** Fired when user hovers a nav item — consumer calls prefetchRoute(to) */
  prefetch: [to: RouteLocationRaw]
  /** Fired when collapsed state changes */
  collapse: [value: boolean]
  /** Fired when a nav item is clicked */
  "item-click": [item: SidebarNavItem]
}>();

const SidebarMobile = defineAsyncComponent(
  () => import("./NavigationSidebarMobile.vue"),
);

// Build per-instance state from the factory instance
const state = buildSidebarState(sidebar);

// Per-instance navigation resolver — NO module-level refs
const { activeItemId, activePathIds, isActive, isOnActivePath } = useNavigation(
  state.resolvedItems,
);

// Provide full state to entire component subtree via typed Symbol key
provide(SIDEBAR_STATE_KEY, {
  ...state,
  activeItemId,
  activePathIds,
  isActive,
  isOnActivePath,
  onPrefetch: (to: RouteLocationRaw) => emit("prefetch", to),
});

const isCollapsed = computed(() => sidebar.isCollapsed.value);
</script>

<template>
  <div>
    <!-- Desktop sidebar — hidden on small screens -->
    <aside
      :class="{ 'sidebar--collapsed': isCollapsed }"
      aria-label="Main navigation"
      class="sidebar sidebar--flat"
    >
      <SidebarHeader>
        <template
          v-if="$slots['header-end']"
          #end
        >
          <slot name="header-end" />
        </template>
      </SidebarHeader>

      <SidebarNav />

      <SidebarFooter>
        <template
          v-if="$slots['footer-start']"
          #start
        >
          <slot name="footer-start" />
        </template>
        <template
          v-if="$slots['footer-end']"
          #end
        >
          <slot name="footer-end" />
        </template>
      </SidebarFooter>
    </aside>

    <!-- Mobile sidebar (lazy loaded — desktop users don't download this) -->
    <SidebarMobile>
      <template
        v-if="$slots['footer-start']"
        #start
      >
        <slot name="footer-start" />
      </template>
      <template
        v-if="$slots['footer-end']"
        #end
      >
        <slot name="footer-end" />
      </template>
    </SidebarMobile>
  </div>
</template>

<style>
@import '../../styles/components/navigation-sidebar/sidebar.scss';
</style>
