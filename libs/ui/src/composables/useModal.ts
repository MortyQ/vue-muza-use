import { computed, onBeforeUnmount } from "vue";

import { useModalRegisterer } from "./useModalRegister";

/**
 * Composable for managing modal state
 * Automatically registers and unregisters modal on mount/unmount
 *
 * @param id - Unique identifier for the modal
 * @param autoUnregister - Whether to automatically unregister modal on unmount (default: true)
 * @returns Modal state and control methods
 *
 * @example
 * ```vue
 * <script setup>
 * const { isOpen, open, close, zIndex } = useModal('my-modal');
 * </script>
 *
 * <template>
 *   <button @click="open">Open Modal</button>
 *   <Teleport to="body">
 *     <div v-if="isOpen" :style="{ zIndex }">
 *       <div>Modal content</div>
 *       <button @click="close">Close</button>
 *     </div>
 *   </Teleport>
 * </template>
 * ```
 */
export const useModal = (id: string, autoUnregister = true) => {
  const registerer = useModalRegisterer();

  // Register modal on creation
  registerer.register(id);

  // Computed properties
  const isOpen = computed(() => registerer.isOpen.value(id));
  const zIndex = computed(() => registerer.getZIndex.value(id));
  const modal = computed(() => registerer.getModal.value(id));

  // Methods
  const open = () => registerer.open(id);
  const close = () => registerer.close(id);
  const toggle = () => registerer.toggle(id);

  // Cleanup on unmount
  if (autoUnregister) {
    onBeforeUnmount(() => {
      registerer.unregister(id);
    });
  }

  return {
    isOpen,
    zIndex,
    modal,
    open,
    close,
    toggle,
  };
};
