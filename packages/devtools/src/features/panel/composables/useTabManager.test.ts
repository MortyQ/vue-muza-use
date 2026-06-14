import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick, defineComponent } from "vue";
import { registerTab, unregisterTab } from "../../../shared/plugins/tabRegistry";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadActiveTab: vi.fn().mockResolvedValue(undefined),
    saveActiveTab: vi.fn().mockResolvedValue(undefined),
}));

import { loadActiveTab, saveActiveTab } from "../../../shared/storage/devtoolsStorage";
import { useTabManager } from "./useTabManager";

const stubComp = defineComponent({ template: "<div/>" });

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => {
    vi.clearAllMocks();
    // clean up any previously registered tabs
    unregisterTab("tab-a");
    unregisterTab("tab-b");
});

describe("default active tab", () => {
    it("defaults to the first registered tab when no storage value", async () => {
        registerTab({ id: "tab-a", label: "A", component: stubComp, order: 1 });
        const { result, unmount } = withSetup(() => useTabManager());
        await nextTick();
        await nextTick();
        expect(result.activeTabId.value).toBe("tab-a");
        unmount();
        unregisterTab("tab-a");
    });

    it("restores saved tab id from storage", async () => {
        vi.mocked(loadActiveTab).mockResolvedValue("tab-b");
        registerTab({ id: "tab-a", label: "A", component: stubComp, order: 1 });
        registerTab({ id: "tab-b", label: "B", component: stubComp, order: 2 });
        const { result, unmount } = withSetup(() => useTabManager());
        await nextTick();
        await nextTick();
        expect(result.activeTabId.value).toBe("tab-b");
        unmount();
        unregisterTab("tab-a");
        unregisterTab("tab-b");
    });
});

describe("setActiveTab", () => {
    it("changes the active tab and persists to storage", async () => {
        registerTab({ id: "tab-a", label: "A", component: stubComp, order: 1 });
        registerTab({ id: "tab-b", label: "B", component: stubComp, order: 2 });
        const { result, unmount } = withSetup(() => useTabManager());
        result.setActiveTab("tab-b");
        await nextTick();
        expect(result.activeTabId.value).toBe("tab-b");
        expect(saveActiveTab).toHaveBeenCalledWith("tab-b");
        unmount();
        unregisterTab("tab-a");
        unregisterTab("tab-b");
    });
});

describe("activeTab computed", () => {
    it("returns the tab object for the active id", () => {
        registerTab({ id: "tab-a", label: "Alpha", component: stubComp, order: 1 });
        const { result, unmount } = withSetup(() => useTabManager());
        result.setActiveTab("tab-a");
        expect(result.activeTab.value?.label).toBe("Alpha");
        unmount();
        unregisterTab("tab-a");
    });
});
