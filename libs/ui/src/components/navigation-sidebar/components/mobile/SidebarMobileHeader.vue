<script lang="ts" setup>
import VIcon from "../../../base/VIcon.vue";
import { useSidebarState } from "../../composables/useSidebarState";

const { closeMobile, options } = useSidebarState();
</script>

<template>
  <div class="sidebar-mobile-header">
    <div
      v-if="options.logoUrl"
      class="sidebar-mobile-header__logo"
    >
      <img
        :alt="options.brandName"
        :src="options.logoUrl"
      >
    </div>

    <h1
      v-if="options.brandName"
      class="sidebar-mobile-header__name"
    >
      {{ options.brandName }}
    </h1>

    <button
      aria-label="Close menu"
      class="sidebar-mobile-header__close"
      type="button"
      @click="closeMobile"
    >
      <VIcon
        :size="20"
        icon="lucide:x"
      />
    </button>
  </div>
</template>
