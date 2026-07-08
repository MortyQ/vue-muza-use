import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";

// Mock the bridge before importing useApi.
// NOTE: The factory must not reference top-level variables (vi.mock is hoisted).
// We expose the bridge via a getter so tests can access mock.calls directly.
vi.mock("../devtools", () => {
    const bridge = {
        onInstanceCreated: vi.fn(),
        onInstanceDestroyed: vi.fn(),
        onStateUpdate: vi.fn(),
        onRequestStart: vi.fn(),
        onRequestEnd: vi.fn(),
    };
    return {
        nextRequestId: vi.fn(() => "req_1"),
        devtoolsBridge: bridge,
        initDevtools: vi.fn(),
        setDevtoolsExpected: vi.fn(),
        isDevtoolsExpected: vi.fn(() => true),
    };
});

import { useApi } from "../useApi";
import { createApi } from "../plugin";
import { devtoolsBridge, isDevtoolsExpected } from "../devtools";
import { clearAllCache } from "../features/cacheManager";

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as typeof axios;

function withSetup<T>(composable: () => T): [T, ReturnType<typeof mount>] {
    let result!: T;
    const wrapper = mount(defineComponent({
        setup() { result = composable(); return () => null; },
    }), {
        global: { plugins: [createApi({ axios: mockAxios as never })] },
    });
    return [result, wrapper];
}

beforeEach(() => {
    vi.mocked(mockAxios.request).mockResolvedValue({
        data: { id: 1 }, status: 200, headers: {}, config: {} as never, statusText: "OK",
    });
    vi.clearAllMocks();
});

afterEach(() => { vi.clearAllMocks(); });

describe("useApi — devtools: onInstanceCreated", () => {
    it("calls onInstanceCreated when composable is set up", () => {
        withSetup(() => useApi("/users"));
        expect(devtoolsBridge.onInstanceCreated).toHaveBeenCalledOnce();
        const [id, url] = vi.mocked(devtoolsBridge.onInstanceCreated).mock.calls[0];
        expect(typeof id).toBe("string");
        expect(url).toBe("/users");
    });

    it("passes mapped options to onInstanceCreated", () => {
        withSetup(() => useApi("/users", { immediate: true, lazy: false, retry: 3 }));
        const [, , opts] = vi.mocked(devtoolsBridge.onInstanceCreated).mock.calls[0];
        expect(opts.immediate).toBe(true);
        expect(opts.retry).toBe(3);
    });
});

describe("useApi — devtools: state watch gated by isDevtoolsExpected", () => {
    it("does not call onStateUpdate when devtools is not expected", async () => {
        vi.mocked(isDevtoolsExpected).mockReturnValueOnce(false);
        const [{ execute }] = withSetup(() => useApi("/users"));
        execute();
        await flushPromises();
        expect(devtoolsBridge.onStateUpdate).not.toHaveBeenCalled();
    });

    it("calls onStateUpdate when devtools is expected", async () => {
        const [{ execute }] = withSetup(() => useApi("/users"));
        execute();
        await flushPromises();
        expect(devtoolsBridge.onStateUpdate).toHaveBeenCalled();
    });
});

describe("useApi — devtools: onInstanceDestroyed", () => {
    it("calls onInstanceDestroyed when scope is disposed", () => {
        const [, wrapper] = withSetup(() => useApi("/users"));
        wrapper.unmount();
        expect(devtoolsBridge.onInstanceDestroyed).toHaveBeenCalledOnce();
    });
});

describe("useApi — devtools: onRequestStart / onRequestEnd", () => {
    it("calls onRequestStart when a request begins", async () => {
        const [{ execute }] = withSetup(() => useApi("/users"));
        execute();
        await flushPromises();
        expect(devtoolsBridge.onRequestStart).toHaveBeenCalledOnce();
        const record = vi.mocked(devtoolsBridge.onRequestStart).mock.calls[0][0];
        expect(record.url).toBe("/users");
        expect(record.method).toBe("GET");
        expect(record.status).toBe("pending");
    });

    it("calls onRequestEnd with success result after successful request", async () => {
        const [{ execute }] = withSetup(() => useApi("/users"));
        execute();
        await flushPromises();
        expect(devtoolsBridge.onRequestEnd).toHaveBeenCalledOnce();
        const result = vi.mocked(devtoolsBridge.onRequestEnd).mock.calls[0][1];
        expect(result.status).toBe("success");
        expect(result.statusCode).toBe(200);
    });

    it("calls onRequestEnd with error result after failed request", async () => {
        vi.mocked(mockAxios.request).mockRejectedValue(
            Object.assign(new Error("Server error"), { response: { status: 500, data: {} }, isAxiosError: true }),
        );
        const [{ execute }] = withSetup(() =>
            useApi("/users", { skipErrorNotification: true }),
        );
        execute();
        await flushPromises();
        const result = vi.mocked(devtoolsBridge.onRequestEnd).mock.calls[0][1];
        expect(result.status).toBe("error");
    });

    it("does not call onRequestStart on cache hit (no HTTP request)", async () => {
        // First call — populates cache
        const [{ execute: exec1 }] = withSetup(() =>
            useApi("/users", { cache: { id: "test-cache-devtools" } }),
        );
        exec1();
        await flushPromises();
        vi.clearAllMocks();

        // Second call — cache hit, no HTTP request
        const [{ execute: exec2 }] = withSetup(() =>
            useApi("/users", { cache: { id: "test-cache-devtools" } }),
        );
        exec2();
        await flushPromises();
        expect(devtoolsBridge.onRequestStart).not.toHaveBeenCalled();
    });
});

describe("useApi — devtools: cache info fields", () => {
    beforeEach(() => {
        clearAllCache();
    });

    it("onRequestStart record carries the resolved cacheKey when cache is active", async () => {
        const [{ execute }] = withSetup(() =>
            useApi("/test", { cache: true, params: { page: 1 } }),
        );
        execute();
        await flushPromises();
        expect(devtoolsBridge.onRequestStart).toHaveBeenCalledWith(
            expect.objectContaining({ cacheKey: "auto:GET:/test:{\"page\":1}:" }),
        );
    });

    it("onRequestStart record carries cacheKey: null when caching is off", async () => {
        const [{ execute }] = withSetup(() => useApi("/test"));
        execute();
        await flushPromises();
        expect(devtoolsBridge.onRequestStart).toHaveBeenCalledWith(
            expect.objectContaining({ cacheKey: null }),
        );
    });

    it("onRequestEnd success result carries cachedAt when the response was cached", async () => {
        const before = Date.now();
        const [{ execute }] = withSetup(() =>
            useApi("/test", { cache: true }),
        );
        execute();
        await flushPromises();
        const calls = vi.mocked(devtoolsBridge.onRequestEnd).mock.calls;
        const [, result] = calls[calls.length - 1];
        expect(result.status).toBe("success");
        expect(result).toEqual(expect.objectContaining({ cachedAt: expect.any(Number) }));
        if (result.status === "success" && result.cachedAt !== undefined) {
            expect(result.cachedAt).toBeGreaterThanOrEqual(before);
        }
    });

    it("onRequestEnd success result has NO cachedAt when caching is off", async () => {
        const [{ execute }] = withSetup(() => useApi("/test"));
        execute();
        await flushPromises();
        const calls = vi.mocked(devtoolsBridge.onRequestEnd).mock.calls;
        const [, result] = calls[calls.length - 1];
        expect(result.status).toBe("success");
        expect(result).not.toHaveProperty("cachedAt");
    });
});
