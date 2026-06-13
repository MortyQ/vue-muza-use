<script lang="ts" setup>
import { computed } from "vue";

import VIcon from "./VIcon.vue";

export interface ThemeOption {
  value: string
  label: string
  /** Any lucide/iconify icon id, e.g. "lucide:sun" */
  icon?: string
}

const {
  themes,
  variant = "cycle",
  size = "md",
} = defineProps<{
  /** All available theme options — labels + icons */
  themes: ThemeOption[]
  /**
   * "cycle"   — single icon button that cycles through themes on click
   * "segment" — all themes displayed as a segmented-control strip
   */
  variant?: "cycle" | "segment"
  size?: "sm" | "md" | "lg"
}>();

const model = defineModel<string>({ required: true });

const iconSize = computed(() => ({ sm: 14, md: 16, lg: 20 }[size]));

const currentTheme = computed(
  () => themes.find(t => t.value === model.value) ?? themes[0],
);

const nextTheme = computed(() => {
  const i = themes.findIndex(t => t.value === model.value);
  return themes[(i + 1) % themes.length];
});

const cycle = () => {
  model.value = nextTheme.value.value;
};

const rootClass = computed(() => [
  "v-theme-switcher",
  `v-theme-switcher--${variant}`,
  `v-theme-switcher--${size}`,
]);

</script>

<template>
  <!-- ── Cycle variant: single animated icon button ── -->
  <button
    v-if="variant === 'cycle'"
    :aria-label="`Theme: ${currentTheme?.label}. Switch to ${nextTheme?.label}`"
    :class="rootClass"
    :title="`Switch to ${nextTheme?.label}`"
    type="button"
    @click="cycle"
  >
    <Transition
      mode="out-in"
      name="v-theme-icon"
    >
      <VIcon
        :key="model"
        :icon="currentTheme?.icon ?? 'lucide:palette'"
        :size="iconSize"
      />
    </Transition>
  </button>

  <!-- ── Segment variant: strip with all themes ── -->
  <div
    v-else
    :class="rootClass"
  >
    <button
      v-for="theme in themes"
      :key="theme.value"
      :aria-pressed="model === theme.value"
      :class="{ 'v-ts__item--active': model === theme.value }"
      :title="theme.label"
      class="v-ts__item"
      type="button"
      @click="model = theme.value"
    >
      <VIcon
        v-if="theme.icon"
        :icon="theme.icon"
        :size="iconSize"
      />
      <span class="v-ts__label">{{ theme.label }}</span>
    </button>
  </div>
</template>
<style scoped>
@import "../../styles/components/base/vthemeswitcher.scss";
</style>
