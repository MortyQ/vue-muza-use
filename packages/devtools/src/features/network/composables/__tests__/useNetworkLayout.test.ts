import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";

vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

import { get, set } from "idb-keyval";
import { useNetworkLayout } from "../useNetworkLayout";

function withSetup<T>(composable: () => T): [T, ReturnType<typeof mount>] {
    let result!: T;
    const wrapper = mount(defineComponent({
        setup() { result = composable(); return () => null; },
    }));
    return [result, wrapper];
}

describe("useNetworkLayout", () => {
    beforeEach(() => {
        vi.mocked(get).mockResolvedValue(undefined);
        vi.mocked(set).mockResolvedValue(undefined);
        vi.clearAllMocks();
    });

    it("defaults to both visible", async () => {
        const [{ toolbarVisible, filterVisible }] = withSetup(useNetworkLayout);
        await flushPromises();
        expect(toolbarVisible.value).toBe(true);
        expect(filterVisible.value).toBe(true);
    });

    it("loads persisted false from IndexedDB", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const [{ toolbarVisible }] = withSetup(useNetworkLayout);
        await flushPromises();
        expect(toolbarVisible.value).toBe(false);
    });

    it("toggleToolbar flips value and saves", async () => {
        const [{ toolbarVisible, toggleToolbar }] = withSetup(useNetworkLayout);
        await flushPromises();
        toggleToolbar();
        expect(toolbarVisible.value).toBe(false);
        expect(set).toHaveBeenCalledWith("vmd:network-toolbar-visible", false);
    });

    it("toggleFilter flips value and saves", async () => {
        const [{ filterVisible, toggleFilter }] = withSetup(useNetworkLayout);
        await flushPromises();
        toggleFilter();
        expect(filterVisible.value).toBe(false);
        expect(set).toHaveBeenCalledWith("vmd:network-filter-visible", false);
    });

    it("toggleSettings flips settingsOpen", () => {
        const [{ settingsOpen, toggleSettings }] = withSetup(useNetworkLayout);
        expect(settingsOpen.value).toBe(false);
        toggleSettings();
        expect(settingsOpen.value).toBe(true);
        toggleSettings();
        expect(settingsOpen.value).toBe(false);
    });

    it("closeSettings sets settingsOpen to false", () => {
        const [{ settingsOpen, toggleSettings, closeSettings }] = withSetup(useNetworkLayout);
        toggleSettings();
        expect(settingsOpen.value).toBe(true);
        closeSettings();
        expect(settingsOpen.value).toBe(false);
    });
});
