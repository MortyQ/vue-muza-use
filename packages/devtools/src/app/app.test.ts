import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App } from "vue";

vi.mock("../shared/store/devtoolsStore", () => ({ initDevtoolsStore: vi.fn() }));
vi.mock("../shared/plugins/tabRegistry", () => ({ registerTab: vi.fn() }));
vi.mock("./devtoolsPlugin", () => ({ mountDevtoolsPanel: vi.fn() }));

import { initDevtoolsStore } from "../shared/store/devtoolsStore";
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
});
