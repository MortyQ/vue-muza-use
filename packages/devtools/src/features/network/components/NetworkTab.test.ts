import { describe, it, expect, vi } from "vitest";
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

vi.mock("../composables/useNetworkLayout", () => ({
    useNetworkLayout: vi.fn(() => ({
        toolbarVisible: ref(true),
        filterVisible: ref(true),
        settingsOpen: ref(false),
        toggleToolbar: vi.fn(),
        toggleFilter: vi.fn(),
        toggleSettings: vi.fn(),
        closeSettings: vi.fn(),
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
