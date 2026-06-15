import { ref, onMounted } from "vue";
import type { Ref } from "vue";
import {
    loadNetworkToolbarVisible, saveNetworkToolbarVisible,
    loadNetworkFilterVisible, saveNetworkFilterVisible,
} from "../../../shared/storage/devtoolsStorage";

/**
 * Return type for the useNetworkLayout composable.
 */
export interface UseNetworkLayoutReturn {
    /** Whether the toolbar row (filter URL, instance select, buttons) is visible. */
    toolbarVisible: Ref<boolean>;
    /** Whether the filter-pills bar is visible. */
    filterVisible: Ref<boolean>;
    /** Toggle toolbar visibility and persist. */
    toggleToolbar: () => void;
    /** Toggle filter bar visibility and persist. */
    toggleFilter: () => void;
}

/**
 * Composable for network tab layout state.
 * Manages toolbar and filter bar visibility — all persisted to IndexedDB.
 *
 * @example
 * ```ts
 * const { toolbarVisible, filterVisible, toggleToolbar, toggleFilter } = useNetworkLayout();
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

    return { toolbarVisible, filterVisible, toggleToolbar, toggleFilter };
}
