import { ref, computed, watch, onMounted, type ComputedRef, type Ref } from "vue";
import { registeredTabs } from "../../../shared/plugins/tabRegistry";
import { loadActiveTab, saveActiveTab } from "../../../shared/storage/devtoolsStorage";

type TabEntry = (typeof registeredTabs.value)[number];

/**
 * Return type for {@link useTabManager}.
 */
export interface UseTabManagerReturn {
    registeredTabs: typeof registeredTabs;
    activeTabId: Ref<string | null>;
    activeTab: ComputedRef<TabEntry | null>;
    setActiveTab: (id: string) => void;
}

/**
 * Composable for managing which tab is active in the devtools panel.
 * Persists the active tab id to IndexedDB.
 *
 * @example
 * ```ts
 * const { activeTabId, setActiveTab } = useTabManager();
 * setActiveTab("network");
 * ```
 */
export function useTabManager(): UseTabManagerReturn {
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

    const activeTab = computed<TabEntry | null>(
        () => registeredTabs.value.find((t) => t.id === activeTabId.value) ?? registeredTabs.value[0] ?? null,
    );

    function setActiveTab(id: string): void {
        activeTabId.value = id;
    }

    return { registeredTabs, activeTabId, activeTab, setActiveTab };
}
