import { ref, computed, watch, onMounted } from "vue";
import { registeredTabs } from "../../../shared/plugins/tabRegistry";
import { loadActiveTab, saveActiveTab } from "../../../shared/storage/devtoolsStorage";

/**
 * Composable for managing which tab is active in the devtools panel.
 * Restores the last active tab from IndexedDB on mount and persists
 * any tab change back to storage.
 *
 * @example
 * ```ts
 * const { activeTabId, activeTab, setActiveTab } = useTabManager();
 * setActiveTab("requests");
 * ```
 */
export function useTabManager() {
    const activeTabId = ref<string | null>(null);

    onMounted(async () => {
        const saved = await loadActiveTab();
        if (saved) {
            activeTabId.value = saved;
        } else if (registeredTabs.value.length > 0) {
            activeTabId.value = registeredTabs.value[0].id;
        }
    });

    watch(activeTabId, (id) => {
        if (id) saveActiveTab(id);
    });

    const activeTab = computed(
        () => registeredTabs.value.find((t) => t.id === activeTabId.value) ?? registeredTabs.value[0] ?? null,
    );

    function setActiveTab(id: string): void {
        activeTabId.value = id;
    }

    return { registeredTabs, activeTabId, activeTab, setActiveTab };
}
