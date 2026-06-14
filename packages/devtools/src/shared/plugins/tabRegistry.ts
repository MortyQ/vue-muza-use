import { reactive, computed, type ComputedRef } from "vue";
import type { DevtoolsTab } from "../types/index";

interface RegisteredTab extends DevtoolsTab {
    order: number;
}

const state = reactive<{ tabs: RegisteredTab[] }>({ tabs: [] });

/**
 * All currently registered devtools tabs, sorted by order ascending.
 */
export const registeredTabs: ComputedRef<ReadonlyArray<RegisteredTab>> = computed(() =>
    [...state.tabs].sort((a, b) => a.order - b.order),
);

/**
 * Register a tab in the devtools panel.
 * Silently ignores duplicate tab ids.
 */
export function registerTab(tab: DevtoolsTab): void {
    if (state.tabs.some((t) => t.id === tab.id)) return;
    const order = tab.order ?? state.tabs.length + 10;
    state.tabs.push({ ...tab, order });
}

/**
 * Unregister a tab by id.
 * Silently ignores unknown ids.
 */
export function unregisterTab(id: string): void {
    const idx = state.tabs.findIndex((t) => t.id === id);
    if (idx !== -1) state.tabs.splice(idx, 1);
}
