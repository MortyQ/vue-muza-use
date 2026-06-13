<script lang="ts" setup>
import { useModal } from "../../composables/useModal";
import VIcon from "../base/VIcon.vue";

const {
  id,
  title = "",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  position = "right",
  width = "md",
  backdropBlur = "xs",
  keepAlive = false,
} = defineProps<{
  id: string
  title?: string
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  position?: "left" | "right"
  width?: "sm" | "md" | "lg" | "xl" | "full"
  backdropBlur?: "none" | "xs" | "sm" | "md" | "lg"
  keepAlive?: boolean
}>();

const emit = defineEmits<{
  close: []
  open: []
}>();

const { isOpen, close, zIndex } = useModal(id);

const handleClose = () => {
  close();
  emit("close");
};

const handleBackdropClick = () => {
  if (closeOnBackdrop) handleClose();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (closeOnEscape && event.key === "Escape") handleClose();
};
</script>

<template>
  <Teleport to="body">
    <Transition
      name="v-drawer"
      @after-enter="emit('open')"
    >
      <div
        v-if="keepAlive ? true : isOpen"
        v-show="keepAlive ? isOpen : true"
        :class="backdropBlur !== 'none' ? `v-drawer__backdrop--blur-${backdropBlur}` : ''"
        :style="{ zIndex }"
        class="v-drawer__backdrop"
        @click="handleBackdropClick"
        @keydown="handleKeydown"
      >
        <div
          :class="[`v-drawer__container--width-${width}`, `v-drawer__container--${position}`]"
          class="v-drawer__container"
          @click.stop
        >
          <!-- Header -->
          <div
            v-if="title || showCloseButton || $slots.header"
            class="v-drawer__header"
          >
            <slot name="header">
              <h3
                v-if="title"
                class="v-drawer__title"
              >
                {{ title }}
              </h3>
            </slot>
            <button
              v-if="showCloseButton"
              aria-label="Close drawer"
              class="v-drawer__close-btn"
              type="button"
              @click="handleClose"
            >
              <VIcon
                icon="lucide:x"
                :size="20"
              />
            </button>
          </div>

          <!-- Content -->
          <div class="v-drawer__content">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="v-drawer__footer"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import "../../styles/components/overlay/vdrawer.scss";
</style>
