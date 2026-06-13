import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  type Ref,
  shallowRef,
} from "vue";

import { useVirtualizer } from "@tanstack/vue-virtual";

import type { VirtualTableOptions } from "../types";

export function useVirtualTable(
  scrollContainerRef: Ref<HTMLElement | null>,
  data: Ref<Record<string, unknown>[]>,
  options: VirtualTableOptions = {},
) {
  const {
    estimateSize = 50,
    overscan = 3,
    measureElement = false,
  } = options;

  const isScrolling = shallowRef(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let listenerAttached = false;

  const virtualizerOptions: Record<string, unknown> = {
    get count() {
      return data.value.length;
    },
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => estimateSize,
    overscan,
    scrollingDelay: 150,
  };

  if (measureElement) {
    virtualizerOptions.measureElement = (el: Element | null) => {
      if (!el || isScrolling.value) return estimateSize;
      return el.getBoundingClientRect().height || estimateSize;
    };
  }

  const virtualizer = useVirtualizer(virtualizerOptions as never);
  const virtualItems = computed(() => virtualizer.value.getVirtualItems());
  const totalSize = computed(() => virtualizer.value.getTotalSize());

  const handleScroll = () => {
    isScrolling.value = true;

    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      isScrolling.value = false;
    }, 150);
  };

  const setupScrollListener = () => {
    const el = scrollContainerRef.value;
    if (el && !listenerAttached) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      listenerAttached = true;
    }
  };

  const removeScrollListener = () => {
    const el = scrollContainerRef.value;
    if (el && listenerAttached) {
      el.removeEventListener("scroll", handleScroll);
      listenerAttached = false;
    }
  };

  const clearScrollTimeout = () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
  };

  onMounted(() => {
    requestAnimationFrame(() => {
      setupScrollListener();
    });
  });

  onActivated(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.value;
      if (!el || !virtualizer.value) return;

      virtualizer.value.measure();
      setupScrollListener();
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
  });

  onDeactivated(() => {
    clearScrollTimeout();
  });

  onUnmounted(() => {
    removeScrollListener();
    clearScrollTimeout();
  });

  return {
    virtualizer,
    virtualItems,
    totalSize,
  };
}
