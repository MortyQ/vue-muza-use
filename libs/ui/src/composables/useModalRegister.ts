import { computed, ref } from "vue";

export interface Modal {
  id: string
  isOpen: boolean
  zIndex: number
}

const modals = ref<Map<string, Modal>>(new Map());
const zIndexCounter = 1000;

export const useModalRegisterer = () => {
  // Getters
  const getModal = computed(() => (id: string) => modals.value.get(id));

  const isOpen = computed(() => (id: string) => {
    const modal = modals.value.get(id);
    return modal ? modal.isOpen : false;
  });

  const getZIndex = computed(() => (id: string) => {
    const modal = modals.value.get(id);
    return modal ? modal.zIndex : 1000;
  });

  const openModals = computed(() => {
    return Array.from(modals.value.values()).filter(modal => modal.isOpen);
  });

  const hasOpenModals = computed(() => openModals.value.length > 0);

  const register = (id: string) => {
    if (!modals.value.has(id)) {
      modals.value.set(id, {
        id,
        isOpen: false,
        zIndex: 1000,
      });
    }
  };

  const unregister = (id: string) => {
    modals.value.delete(id);
  };

  const open = (id: string) => {
    register(id);
    const modal = modals.value.get(id);
    if (modal) {
      modal.zIndex = zIndexCounter + 10;
      modal.isOpen = true;
    }
  };

  const close = (id: string) => {
    const modal = modals.value.get(id);
    if (modal) {
      modal.isOpen = false;
    }
  };

  const toggle = (id: string) => {
    const modal = modals.value.get(id);
    if (modal) {
      if (modal.isOpen) {
        close(id);
      }
      else {
        open(id);
      }
    }
  };

  const closeAll = () => {
    modals.value.forEach((modal) => {
      modal.isOpen = false;
    });
  };

  return {
    modals,
    getModal,
    isOpen,
    getZIndex,
    openModals,
    hasOpenModals,
    register,
    unregister,
    open,
    close,
    toggle,
    closeAll,
  };
};
