<script lang="ts" setup>
import { computed } from "vue";

import { useModal } from "../../composables/useModal";
import VButton from "../base/VButton.vue";
import VIcon from "../base/VIcon.vue";

type ButtonVariant = "primary" | "positive" | "negative" | "warning" | "link";

interface FooterActionsConfig {
  confirmText?: string
  cancelText?: string
  confirmVariant?: ButtonVariant
  cancelVariant?: ButtonVariant
  showConfirm?: boolean
  showCancel?: boolean
}

const {
  id,
  title = "",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  maxWidth = "md",
  footerActions = undefined,
  loading = false,
} = defineProps<{
  id: string
  title?: string
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
  footerActions?: boolean | FooterActionsConfig
  loading?: boolean
}>();

const emit = defineEmits<{
  close: []
  open: []
  confirm: []
}>();

const { isOpen, close, zIndex } = useModal(id);

const DEFAULT_FOOTER_ACTIONS: Required<FooterActionsConfig> = {
  confirmText: "Confirm",
  cancelText: "Cancel",
  confirmVariant: "primary",
  cancelVariant: "link",
  showConfirm: true,
  showCancel: true,
};

const resolvedActions = computed(() => {
  if (!footerActions) return null;
  if (footerActions === true) return DEFAULT_FOOTER_ACTIONS;
  return { ...DEFAULT_FOOTER_ACTIONS, ...footerActions };
});

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
      name="v-modal"
      @after-enter="emit('open')"
    >
      <div
        v-if="isOpen"
        :style="{ zIndex }"
        class="v-modal__backdrop"
        @click="handleBackdropClick"
        @keydown="handleKeydown"
      >
        <div
          :class="`v-modal__container--${maxWidth}`"
          class="v-modal__container"
          @click.stop
        >
          <!-- Header -->
          <div
            v-if="title || showCloseButton || $slots.header"
            class="v-modal__header"
          >
            <slot name="header">
              <h3
                v-if="title"
                class="v-modal__title"
              >
                {{ title }}
              </h3>
            </slot>
            <button
              v-if="showCloseButton"
              aria-label="Close modal"
              class="v-modal__close-btn"
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
          <div class="v-modal__content">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer || resolvedActions"
            class="v-modal__footer"
          >
            <slot name="footer">
              <div
                v-if="resolvedActions"
                class="v-modal__footer-actions"
              >
                <VButton
                  v-if="resolvedActions.showCancel"
                  :disabled="loading"
                  :variant="resolvedActions.cancelVariant"
                  type="button"
                  @click="handleClose"
                >
                  {{ resolvedActions.cancelText }}
                </VButton>
                <VButton
                  v-if="resolvedActions.showConfirm"
                  :loading="loading"
                  :variant="resolvedActions.confirmVariant"
                  type="button"
                  @click="emit('confirm')"
                >
                  {{ resolvedActions.confirmText }}
                </VButton>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import "../../styles/components/overlay/vmodal.scss";
</style>
