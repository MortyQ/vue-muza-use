<script lang="ts" setup>

interface Props {
  size?: "sm" | "md" | "lg"
  message?: string
  fullscreen?: boolean
}

const {
  size = "md",
  message = undefined,
  fullscreen = false,
} = defineProps<Props>();
</script>

<template>
  <div
    :class="{ 'v-loader--fullscreen': fullscreen }"
    aria-label="Loading"
    class="v-loader-container"
    role="status"
  >
    <div
      :class="`v-loader--${size}`"
      class="v-loader"
    />

    <slot>
      <span
        v-if="message"
        class="v-loader-message"
      >{{ message }}</span>
    </slot>
  </div>
</template>

<style scoped>
@import "../../styles/components/feedback/vloader.scss";
</style>
