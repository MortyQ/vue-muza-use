import { ref, onMounted } from "vue";
import type { Ref } from "vue";
import {
    loadNetworkToolbarVisible, saveNetworkToolbarVisible,
    loadNetworkFilterVisible, saveNetworkFilterVisible,
} from "../../../shared/storage/devtoolsStorage";

// Module-level singleton — shared between TabBar trigger and NetworkTab menu
const _settingsOpen = ref(false);

export interface UseNetworkLayoutReturn {
    /** Whether the toolbar row (filter URL, instance select, buttons) is visible. */
    toolbarVisible: Ref<boolean>;
    /** Whether the filter-pills bar is visible. */
    filterVisible: Ref<boolean>;
    /** Whether the settings menu is open. */
    settingsOpen: Ref<boolean>;
    /** Toggle toolbar visibility and persist. */
    toggleToolbar: () => void;
    /** Toggle filter bar visibility and persist. */
    toggleFilter: () => void;
    /** Toggle the settings menu open/closed. */
    toggleSettings: () => void;
    /** Close the settings menu. */
    closeSettings: () => void;
}

/**
 * Composable for Network tab layout visibility controls.
 * Toolbar and filter bar visibility is persisted to IndexedDB.
 * Settings menu open state is a module-level singleton shared across instances.
 *
 * @example
 * ```ts
 * const { toolbarVisible, filterVisible, settingsOpen, toggleToolbar, toggleFilter, toggleSettings } = useNetworkLayout();
 * ```
 */
export function useNetworkLayout(): UseNetworkLayoutReturn {
    const toolbarVisible = ref(true);
    const filterVisible = ref(true);

    onMounted(async () => {
        const [toolbar, filter] = await Promise.all([
            loadNetworkToolbarVisible(),
            loadNetworkFilterVisible(),
        ]);
        toolbarVisible.value = toolbar;
        filterVisible.value = filter;
    });

    function toggleToolbar(): void {
        toolbarVisible.value = !toolbarVisible.value;
        saveNetworkToolbarVisible(toolbarVisible.value);
    }

    function toggleFilter(): void {
        filterVisible.value = !filterVisible.value;
        saveNetworkFilterVisible(filterVisible.value);
    }

    function toggleSettings(): void {
        _settingsOpen.value = !_settingsOpen.value;
    }

    function closeSettings(): void {
        _settingsOpen.value = false;
    }

    return { toolbarVisible, filterVisible, settingsOpen: _settingsOpen, toggleToolbar, toggleFilter, toggleSettings, closeSettings };
}
