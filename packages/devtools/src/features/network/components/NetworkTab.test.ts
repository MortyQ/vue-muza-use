import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, computed } from "vue";

vi.mock("idb-keyval", () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../panel/composables/useFloatingPanel", () => ({
    useFloatingPanel: vi.fn(() => ({
        resetGeometry: vi.fn(),
        geometry: ref({ x: 0, y: 0, width: 380, height: 600 }),
        isGeometryReady: ref(true),
        isOpen: ref(false),
        panelMode: ref("side"),
        startDrag: vi.fn(),
        startResizeTop: vi.fn(),
        startResizeBottom: vi.fn(),
        startResizeLeft: vi.fn(),
        startResizeRight: vi.fn(),
        switchMode: vi.fn(),
        toggle: vi.fn(),
        close: vi.fn(),
    })),
}));

vi.mock("../composables/useNetworkTab", () => ({
    useNetworkTab: vi.fn(() => ({
        urlFilter: ref(""),
        statusFilter: ref("all"),
        instanceFilter: ref("all"),
        filteredRequests: computed(() => []),
        clearFilters: vi.fn(),
        selectedRequest: computed(() => null),
        selectedRequestId: ref(null),
        viewMode: ref("split"),
        payloadFormat: ref("json"),
        responseFormat: ref("json"),
        selectRequest: vi.fn(),
        setViewMode: vi.fn(),
        togglePayloadFormat: vi.fn(),
        toggleResponseFormat: vi.fn(),
        instances: computed(() => new Map()),
    })),
}));

// Plain (non-ref) hoisted holders — `ref()` itself can't be called inside
// vi.hoisted, since that callback runs before the "vue" import is initialized.
// The mock factory below (invoked later, at each mount) wraps the current
// value in a fresh ref, which is enough since tests only need to set the
// initial state before mounting, not react to changes mid-test.
const { settingsOpenState, closeSettingsMock } = vi.hoisted(() => ({
    settingsOpenState: { value: false },
    closeSettingsMock: vi.fn(),
}));

vi.mock("../composables/useNetworkLayout", () => ({
    useNetworkLayout: vi.fn(() => ({
        toolbarVisible: ref(true),
        filterVisible: ref(true),
        settingsOpen: ref(settingsOpenState.value),
        toggleToolbar: vi.fn(),
        toggleFilter: vi.fn(),
        toggleSettings: vi.fn(),
        closeSettings: closeSettingsMock,
    })),
}));

vi.mock("../../../shared/store/devtoolsStore", () => ({
    clearRequests: vi.fn(),
}));

import NetworkTab from "./NetworkTab.vue";

const stubs = {
    RequestList: { template: "<div />" },
    RequestDetail: { template: "<div />" },
    SelectInput: { template: "<div />" },
    Teleport: true,
    Transition: true,
};

describe("NetworkTab", () => {
    it("mounts without crashing", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.exists()).toBe(true);
    });

    it("renders the .network-tab container", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.find(".network-tab").exists()).toBe(true);
    });

    it("renders 'No requests.' when filteredRequests is empty", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.text()).toContain("No requests.");
    });

    it("renders the toolbar when toolbarVisible is true", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.find(".toolbar").exists()).toBe(true);
    });
});

describe("NetworkTab — settings menu click-outside", () => {
    afterEach(() => {
        settingsOpenState.value = false;
        closeSettingsMock.mockClear();
    });

    it("does not render a backdrop when the settings menu is closed", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.find('[style*="z-index: 99"]').exists()).toBe(false);
    });

    it("renders the backdrop directly inside .network-tab (not teleported) when the menu is open", () => {
        settingsOpenState.value = true;
        const wrapper = mount(NetworkTab, { global: { stubs } });
        const networkTab = wrapper.find(".network-tab");
        expect(networkTab.find('[style*="z-index: 99"]').exists()).toBe(true);
    });

    it("clicking the backdrop closes the settings menu", async () => {
        settingsOpenState.value = true;
        const wrapper = mount(NetworkTab, { global: { stubs } });
        await wrapper.find('[style*="z-index: 99"]').trigger("click");
        expect(closeSettingsMock).toHaveBeenCalledOnce();
    });
});
