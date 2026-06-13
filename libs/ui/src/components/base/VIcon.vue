<script lang="ts" setup>
import { computed } from "vue";

import { Icon } from "@iconify/vue";

const {
  icon = "",
  size = 24,
  loading = false,
} = defineProps<{
  icon?: string
  size?: string | number
  loading?: boolean
}>();

const resolvedIcon = computed(() =>
  loading ? "lucide:loader-circle" : icon,
);

const iconSize = computed(() =>
  typeof size === "number" ? size : parseInt(size),
);
</script>

<template>
  <Icon
    :class="{ 'v-icon--spin': loading }"
    :height="iconSize"
    :icon="resolvedIcon"
    :width="iconSize"
    aria-hidden="true"
    class="v-icon"
    focusable="false"
  />
</template>

<style scoped>
.v-icon {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 1;
}

.v-icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
