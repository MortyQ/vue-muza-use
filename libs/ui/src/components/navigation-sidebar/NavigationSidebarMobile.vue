<script lang="ts" setup>
import { useEventListener } from "@vueuse/core";

import SidebarMobileFooter from "./components/mobile/SidebarMobileFooter.vue";
import SidebarMobileHeader from "./components/mobile/SidebarMobileHeader.vue";
import SidebarMobileNav from "./components/mobile/SidebarMobileNav.vue";
import { useSidebarState } from "./composables/useSidebarState";
import type { SidebarNavItem } from "./types";

const { footerItems = [] } = defineProps<{
  /** Optional footer nav items passed down from NavigationSidebar */
  footerItems?: SidebarNavItem[]
}>();

const { isMobileOpen, closeMobile } = useSidebarState();

// Close on Escape key — auto-cleaned on unmount by useEventListener
useEventListener(document, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape" && isMobileOpen.value) closeMobile();
});
</script>

<template>
  <div>
    <!-- Mobile Sidebar -->
    <aside
      :class="{ 'sidebar-mobile--open': isMobileOpen }"
      aria-label="Main navigation"
      class="sidebar-mobile"
    >
      <SidebarMobileHeader />
      <SidebarMobileNav />
      <SidebarMobileFooter :items="footerItems">
        <template
          v-if="$slots.start"
          #start
        >
          <slot name="start" />
        </template>
        <template
          v-if="$slots.end"
          #end
        >
          <slot name="end" />
        </template>
      </SidebarMobileFooter>
    </aside>

    <!-- Overlay -->
    <Transition
      enter-active-class="sidebar-overlay-enter-active"
      enter-from-class="sidebar-overlay-enter-from"
      enter-to-class="sidebar-overlay-enter-to"
      leave-active-class="sidebar-overlay-leave-active"
      leave-from-class="sidebar-overlay-leave-from"
      leave-to-class="sidebar-overlay-leave-to"
    >
      <div
        v-if="isMobileOpen"
        aria-hidden="true"
        class="sidebar-mobile-overlay"
        @click="closeMobile"
      />
    </Transition>
  </div>
</template>

<style scoped>
.sidebar-overlay-enter-active {
  transition: opacity 300ms ease-out;
}

.sidebar-overlay-enter-from {
  opacity: 0;
}

.sidebar-overlay-enter-to {
  opacity: 1;
}

.sidebar-overlay-leave-active {
  transition: opacity 200ms ease-in;
}

.sidebar-overlay-leave-from {
  opacity: 1;
}

.sidebar-overlay-leave-to {
  opacity: 0;
}
</style>
