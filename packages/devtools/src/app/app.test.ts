import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App } from "vue";

vi.mock("../shared/store/devtoolsStore", () => ({ initDevtoolsStore: vi.fn() }));
vi.mock("../shared/plugins/tabRegistry", () => ({ registerTab: vi.fn() }));
vi.mock("./devtoolsPlugin", () => ({ mountDevtoolsPanel: vi.fn() }));
vi.mock("../features/instances/index", () => ({
    instancesTab: { id: "instances", label: "Instances", component: {}, order: 0 },
}));
vi.mock("../features/network/index", () => ({
    networkTab: { id: "network", label: "Network", component: {}, order: 1 },
}));
vi.mock("../features/timeline/index", () => ({
    timelineTab: { id: "timeline", label: "Timeline", component: {}, order: 2 },
}));

import { initDevtoolsStore } from "../shared/store/devtoolsStore";
import { registerTab } from "../shared/plugins/tabRegistry";
import { mountDevtoolsPanel } from "./devtoolsPlugin";
import { createBridge } from "./index";

const mockApp = {} as App;

beforeEach(() => { vi.clearAllMocks(); });

describe("createBridge", () => {
    it("initialises the store with the provided config", () => {
        createBridge({ enabled: true, maxHistory: 50 }, mockApp);
        expect(initDevtoolsStore).toHaveBeenCalledWith({ enabled: true, maxHistory: 50 });
    });

    it("mounts the devtools panel", () => {
        createBridge({ enabled: true }, mockApp);
        expect(mountDevtoolsPanel).toHaveBeenCalledOnce();
    });

    it("returns a bridge object with all required methods", () => {
        const bridge = createBridge({ enabled: true }, mockApp);
        expect(typeof bridge.onInstanceCreated).toBe("function");
        expect(typeof bridge.onInstanceDestroyed).toBe("function");
        expect(typeof bridge.onStateUpdate).toBe("function");
        expect(typeof bridge.onRequestStart).toBe("function");
        expect(typeof bridge.onRequestEnd).toBe("function");
    });

    it("registers the three built-in tabs", () => {
        createBridge({ enabled: true }, mockApp);
        expect(registerTab).toHaveBeenCalledTimes(3);
        const ids = vi.mocked(registerTab).mock.calls.map((c) => c[0].id);
        expect(ids).toContain("instances");
        expect(ids).toContain("network");
        expect(ids).toContain("timeline");
    });

    it("registers custom tabs from options.tabs", () => {
        const customTab = { id: "my-tab", label: "My Tab", component: {}, order: 10 };
        createBridge({ enabled: true, tabs: [customTab as never] }, mockApp);
        const ids = vi.mocked(registerTab).mock.calls.map((c) => c[0].id);
        expect(ids).toContain("my-tab");
    });
});
