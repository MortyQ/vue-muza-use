import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";

vi.mock("../composables/useFloatingPanel", () => ({
    useFloatingPanel: vi.fn(() => ({
        position: ref({ x: 100, y: 100 }),
        size: ref({ width: 800, height: 500 }),
        isOpen: ref(true),
        onDragStart: vi.fn(),
        toggle: vi.fn(),
        close: vi.fn(),
    })),
}));

vi.mock("../composables/useTabManager", () => ({
    useTabManager: () => ({
        registeredTabs: ref([]),
        activeTabId: ref(null),
        activeTab: ref(null),
        setActiveTab: vi.fn(),
    }),
}));

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelPosition: vi.fn(), savePanelPosition: vi.fn(),
    loadPanelSize: vi.fn(), savePanelSize: vi.fn(),
    loadActiveTab: vi.fn(), saveActiveTab: vi.fn(),
}));

import FloatingPanel from "./FloatingPanel.vue";
import PanelHeader from "./PanelHeader.vue";
import TabBar from "./TabBar.vue";

describe("FloatingPanel", () => {
    it("mounts without errors", () => {
        const wrapper = mount(FloatingPanel);
        expect(wrapper.exists()).toBe(true);
    });

    it("renders the panel container", () => {
        const wrapper = mount(FloatingPanel);
        expect(wrapper.find("[data-vmd-panel]").exists()).toBe(true);
    });

    it("hides the panel when isOpen is false", async () => {
        const { useFloatingPanel } = await import("../composables/useFloatingPanel");
        vi.mocked(useFloatingPanel).mockReturnValueOnce({
            position: ref({ x: 0, y: 0 }),
            size: ref({ width: 800, height: 500 }),
            isOpen: ref(false),
            onDragStart: vi.fn(),
            toggle: vi.fn(),
            close: vi.fn(),
        });
        const wrapper = mount(FloatingPanel);
        expect(wrapper.find("[data-vmd-panel-body]").exists()).toBe(false);
    });
});

describe("PanelHeader", () => {
    it("mounts and renders title", () => {
        const wrapper = mount(PanelHeader, {
            props: { onDragStart: vi.fn(), onClose: vi.fn(), onToggle: vi.fn() },
        });
        expect(wrapper.text()).toContain("vue-muza");
    });
});

describe("TabBar", () => {
    it("renders a tab for each registered tab", () => {
        const stubComp = defineComponent({ template: "<div/>" });
        const tabs = [
            { id: "a", label: "Alpha", component: stubComp, order: 1 },
            { id: "b", label: "Beta", component: stubComp, order: 2 },
        ] as const;
        const wrapper = mount(TabBar, {
            props: { tabs, activeTabId: "a", onSelectTab: vi.fn() },
        });
        expect(wrapper.findAll("[data-vmd-tab]")).toHaveLength(2);
    });
});
