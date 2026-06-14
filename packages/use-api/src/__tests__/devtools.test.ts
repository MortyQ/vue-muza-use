import { describe, it, expect, vi, beforeEach } from "vitest";
import type { App } from "vue";

const mockBridge = {
    onInstanceCreated: vi.fn(),
    onInstanceDestroyed: vi.fn(),
    onStateUpdate: vi.fn(),
    onRequestStart: vi.fn(),
    onRequestEnd: vi.fn(),
};

const mockCreateBridge = vi.fn(() => mockBridge);

vi.mock("@ametie/vue-muza-devtools", () => ({
    createBridge: mockCreateBridge,
}));

const mockApp = {} as App;

describe("initDevtools", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset module to clear the bridge singleton between tests
        vi.resetModules();
    });

    it("does nothing when enabled is false", async () => {
        const { initDevtools } = await import("../devtools");
        await initDevtools({ enabled: false }, mockApp);
        expect(mockCreateBridge).not.toHaveBeenCalled();
    });

    it("calls createBridge when enabled is true", async () => {
        const { initDevtools } = await import("../devtools");
        await initDevtools({ enabled: true }, mockApp);
        expect(mockCreateBridge).toHaveBeenCalledWith({ enabled: true }, mockApp);
    });
});

describe("devtoolsBridge — before init", () => {
    beforeEach(() => { vi.resetModules(); });

    it("onInstanceCreated is a no-op when bridge is null", async () => {
        const { devtoolsBridge } = await import("../devtools");
        expect(() =>
            devtoolsBridge.onInstanceCreated("id", "/url", {
                authMode: "default", cache: undefined, retry: false, poll: 0, immediate: true, lazy: false,
            })
        ).not.toThrow();
    });

    it("onRequestStart is a no-op when bridge is null", async () => {
        const { devtoolsBridge } = await import("../devtools");
        expect(() =>
            devtoolsBridge.onRequestStart({
                id: "r1", instanceId: null, url: "/u", method: "GET",
                startedAt: 0, status: "pending", statusCode: null, requestHeaders: {}, payload: null,
            })
        ).not.toThrow();
    });

    it("onStateUpdate is a no-op when bridge is null", async () => {
        const { devtoolsBridge } = await import("../devtools");
        expect(() =>
            devtoolsBridge.onStateUpdate("id", { loading: true })
        ).not.toThrow();
    });

    it("onInstanceDestroyed is a no-op when bridge is null", async () => {
        const { devtoolsBridge } = await import("../devtools");
        expect(() =>
            devtoolsBridge.onInstanceDestroyed("id")
        ).not.toThrow();
    });
});

describe("devtoolsBridge — after init", () => {
    it("forwards onInstanceCreated to the bridge", async () => {
        const { initDevtools, devtoolsBridge } = await import("../devtools");
        await initDevtools({ enabled: true }, mockApp);
        const opts = { authMode: "default" as const, cache: undefined, retry: false, poll: 0, immediate: true, lazy: false };
        devtoolsBridge.onInstanceCreated("id-1", "/users", opts);
        expect(mockBridge.onInstanceCreated).toHaveBeenCalledWith("id-1", "/users", opts);
    });

    it("forwards onRequestEnd to the bridge", async () => {
        const { initDevtools, devtoolsBridge } = await import("../devtools");
        await initDevtools({ enabled: true }, mockApp);
        devtoolsBridge.onRequestEnd("r1", { status: "aborted", duration: 10 });
        expect(mockBridge.onRequestEnd).toHaveBeenCalledWith("r1", { status: "aborted", duration: 10 });
    });

    it("forwards onStateUpdate to the bridge", async () => {
        const { initDevtools, devtoolsBridge } = await import("../devtools");
        await initDevtools({ enabled: true }, mockApp);
        devtoolsBridge.onStateUpdate("id-1", { loading: true });
        expect(mockBridge.onStateUpdate).toHaveBeenCalledWith("id-1", { loading: true });
    });

    it("forwards onInstanceDestroyed to the bridge", async () => {
        const { initDevtools, devtoolsBridge } = await import("../devtools");
        await initDevtools({ enabled: true }, mockApp);
        devtoolsBridge.onInstanceDestroyed("id-1");
        expect(mockBridge.onInstanceDestroyed).toHaveBeenCalledWith("id-1");
    });
});

describe("nextRequestId", () => {
    it("returns incrementing ids", async () => {
        vi.resetModules();
        const { nextRequestId } = await import("../devtools");
        const a = nextRequestId();
        const b = nextRequestId();
        expect(a).not.toBe(b);
        expect(a.startsWith("req_")).toBe(true);
    });
});
