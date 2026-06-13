<script lang="ts" setup>
import { onMounted, ref, watch, nextTick, onBeforeUnmount, computed, type Component } from "vue";

import { useRoute, useRouter } from "vue-router";

import VButton from "../base/VButton.vue";
import VIcon from "../base/VIcon.vue";
import VFloating from "../overlay/VFloating.vue";

const {
  useHash = true,
  tabSelectionMode = "auto",
  loading = false,
  tabs = [],
} = defineProps<{
  tabs?: ITab[]
  loading?: boolean
  useHash?: boolean // Enable/disable URL hash synchronization (default: true)
  /**
   * Tab selection mode:
   * - 'auto' (default): Tabs switch immediately on click
   * - 'controlled': Tab switching is controlled via @tab-selected callback
   *   Parent must call the provided callback to complete the switch
   */
  tabSelectionMode?: "auto" | "controlled"
}>();

const emit = defineEmits<{
  tabSelected: [payload: TabSelectedPayload]
}>();
const router = useRouter();
const route = useRoute();

export type ITab = {
  id: number | string
  label: string
  disabled?: boolean
  icon?: string
  styles?: string
  activeByDefault?: boolean
  component?: Component
};

export interface TabSelectedPayload {
  tabId: number | string
  callback: () => void
  tab?: ITab
}

// Initialize active tab from URL hash or default
const getInitialTab = (): number | string => {
  // First, try to get tab from URL hash (synchronously, before render)
  // Only if useHash is enabled (default true)
  if (useHash && route?.hash) {
    const hashTabId = route.hash.replace("#tab-", "");
    const tabFromHash = tabs.find(tab => String(tab.id) === hashTabId);
    if (tabFromHash) {
      return tabFromHash.id;
    }
  }

  // If no valid hash, use activeByDefault or first tab
  const defaultTab = tabs.find(tab => tab.activeByDefault);
  return defaultTab?.id ?? tabs[0]?.id;
};

const currentTabId = ref<number | string>(getInitialTab());

const activeTab = computed(() => tabs.find(t => t.id === currentTabId.value));

// Handle tab selection
const selectTab = (tabId: number | string, updateRoute = true) => {
  const tab = tabs.find(t => t.id === tabId);

  // Skip if tab doesn't exist or is disabled
  if (!tab || tab.disabled) return;

  // Create callback that completes the tab switch
  const completeTabSwitch = () => {
    currentTabId.value = tabId;

    // Update URL hash only if useHash is enabled (default true)
    if (useHash && updateRoute && route && router && route.hash !== `#tab-${tabId}`) {
      router.push({
        hash: `#tab-${tabId}`,
        query: route.query,
      });
    }
  };

  if (tabSelectionMode === "controlled") {
    // Controlled mode: emit event with callback, parent controls tab switch
    emit("tabSelected", {
      tabId,
      callback: completeTabSwitch,
      tab,
    });
  }
  else {
    // Auto mode (default): switch immediately, emit for notification
    completeTabSwitch();
    emit("tabSelected", {
      tabId,
      callback: () => {
      }, // Already switched, callback is no-op
      tab,
    });
  }
};

const isTabActive = (tabId: number | string): boolean => {
  return currentTabId.value === tabId;
};

// WAI-ARIA keyboard navigation — roving tabindex pattern
const handleTabsKeydown = (event: KeyboardEvent) => {
  const enabledTabs = visibleTabs.value.filter(t => !t.disabled);
  const currentIndex = enabledTabs.findIndex(t => t.id === currentTabId.value);

  let nextIndex: number;

  switch (event.key) {
    case "ArrowRight":
      nextIndex = (currentIndex + 1) % enabledTabs.length;
      break;
    case "ArrowLeft":
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = enabledTabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  const nextTab = enabledTabs[nextIndex];
  selectTab(nextTab.id);
  nextTick(() => {
    (tabsContainerRef.value?.querySelector(`#tab-${nextTab.id}`) as HTMLElement)?.focus();
  });
};

// Overflow tabs logic
const tabsContainerRef = ref<HTMLElement | null>(null);
const visibleTabs = ref<ITab[]>([...tabs]);
const overflowTabs = ref<ITab[]>([]);
const moreButtonWidth = 70; // Width of icon button (48px) + small buffer
const tabWidthCache = new Map<string | number, number>();

const calculateVisibleTabs = () => {
  if (!tabsContainerRef.value || tabs.length === 0) {
    return;
  }

  const container = tabsContainerRef.value;
  const containerWidth = container.offsetWidth;

  if (containerWidth === 0) {
    return;
  }

  const tabElements = container.querySelectorAll(".v-tab-btn:not(.more-button)");

  tabElements.forEach((element) => {
    const tabId = (element as HTMLElement).getAttribute("data-tab-id");
    const width = (element as HTMLElement).offsetWidth;

    if (!tabId) return;

    const tab = tabs.find(t => String(t.id) === tabId);
    if (tab && width > 0) {
      tabWidthCache.set(tab.id, width);
    }
  });

  let totalWidth = 0;
  const tabWidths: number[] = [];

  for (const tab of tabs) {
    const cached = tabWidthCache.get(tab.id);
    const tabWidth = cached || 150;
    tabWidths.push(tabWidth);
    totalWidth += tabWidth;
  }

  if (totalWidth <= containerWidth) {
    visibleTabs.value = [...tabs];
    overflowTabs.value = [];
    return;
  }

  const availableWidth = containerWidth - moreButtonWidth;

  let accumulatedWidth = 0;
  let splitIndex = 0;

  for (let i = 0; i < tabs.length; i++) {
    const tabWidth = tabWidths[i];
    const fits = accumulatedWidth + tabWidth <= availableWidth;
    if (fits) {
      accumulatedWidth += tabWidth;
      splitIndex = i + 1;
    }
    else {
      break;
    }
  }

  visibleTabs.value = tabs.slice(0, splitIndex);
  overflowTabs.value = tabs.slice(splitIndex);
};

// Dropdown items for overflow tabs
const dropdownItems = computed(() => {
  return overflowTabs.value.map(tab => ({
    label: tab.label,
    value: tab.id,
    icon: tab.icon,
    disabled: tab.disabled,
    active: tab.id === currentTabId.value,
  }));
});

// ResizeObserver to recalculate on container size change
let resizeObserver: ResizeObserver | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  if (useHash && route && router && route.hash !== `#tab-${currentTabId.value}`) {
    router.replace({ hash: `#tab-${currentTabId.value}`, query: route.query });
  }
  const initialTab = tabs.find(t => t.id === currentTabId.value);
  emit("tabSelected", {
    tabId: currentTabId.value, callback: () => {
    }, tab: initialTab,
  });

  // nextTick = Vue DOM ready, rAF = браузер применил CSS и посчитал layout
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  calculateVisibleTabs();

  if (tabsContainerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => calculateVisibleTabs(), 100);
    });
    resizeObserver.observe(tabsContainerRef.value);
  }
});

onBeforeUnmount(() => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  if (resizeObserver && tabsContainerRef.value) {
    resizeObserver.unobserve(tabsContainerRef.value);
    resizeObserver.disconnect();
  }
});

// Watch tabs changes
watch(() => [...tabs], async () => {
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  calculateVisibleTabs();
});

// React to external hash changes (e.g. router.push({ hash }) from child components)
watch(() => route?.hash, (newHash) => {
  if (!useHash || !newHash) return;
  const hashTabId = newHash.replace("#tab-", "");
  const tab = tabs.find(t => String(t.id) === hashTabId);
  if (tab && tab.id !== currentTabId.value) {
    selectTab(tab.id, false);
  }
});

defineExpose({
  currentTabId,
  selectTab,
});
</script>

<template>
  <div class="v-tab">
    <!-- Tabs Header -->
    <div
      v-if="tabs.length > 0"
      class="v-tab__header"
    >
      <!-- Loading Skeleton -->
      <section
        v-if="loading"
        aria-busy="true"
        class="v-tab__loading"
      >
        <div
          v-for="item in tabs.length"
          :key="item"
          class="v-tab__skeleton"
        />
      </section>

      <!-- Tabs List -->
      <div
        ref="tabsContainerRef"
        class="v-tab__list-wrapper"
      >
        <div class="v-tab__scroll">
          <nav
            aria-label="Tabs navigation"
            class="v-tab__nav"
            role="tablist"
            @keydown="handleTabsKeydown"
          >
            <button
              v-for="tab in visibleTabs"
              :id="`tab-${tab.id}`"
              :key="tab.id"
              :aria-controls="`tabpanel-${tab.id}`"
              :aria-disabled="tab.disabled"
              :aria-selected="isTabActive(tab.id)"
              :class="[
                {
                  'v-tab-btn--active': isTabActive(tab.id),
                  'v-tab-btn--disabled': tab.disabled,
                },
                tab.styles,
              ]"
              :data-tab-id="tab.id"
              :tabindex="isTabActive(tab.id) ? 0 : -1"
              class="v-tab-btn"
              role="tab"
              type="button"
              @click="selectTab(tab.id)"
            >
              <slot
                v-if="!tab.icon"
                :name="`tab-icon-${tab.id}`"
              />
              <VIcon
                v-else
                :icon="tab.icon"
                class="v-tab__icon"
              />
              <span>{{ tab.label }}</span>
            </button>
          </nav>
        </div>

        <!-- More Button -->
        <div
          v-if="overflowTabs.length > 0"
          class="v-tab__more more-button"
        >
          <VFloating
            :items="dropdownItems"
            placement="bottom-right"
            @select="selectTab"
          >
            <template #trigger>
              <VButton icon="mdi:dots-horizontal" />
            </template>
          </VFloating>
        </div>
      </div>

      <!-- Right Slot -->
      <div
        v-if="$slots['tabs-right']"
        class="v-tab__right"
      >
        <slot
          :current-tab-id="currentTabId"
          name="tabs-right"
        />
      </div>
    </div>

    <!-- Tab Content -->
    <div
      v-if="!loading"
      :id="`tabpanel-${currentTabId}`"
      :aria-labelledby="`tab-${currentTabId}`"
      class="v-tab__panel"
      role="tabpanel"
    >
      <div class="v-tab-content-wrapper pt-4">
        <slot :name="`${currentTabId}`">
          <component
            :is="activeTab.component"
            v-if="activeTab?.component"
          />
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "../../styles/components/layout/vtab.scss";
</style>
