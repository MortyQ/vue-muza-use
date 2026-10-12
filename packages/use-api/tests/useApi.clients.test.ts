/**
 * useApi — named clients (`createApi({ clients })` + `client` option)
 *
 * Covers the use-api-named-clients spec scenarios for useApi and the method helpers:
 *  - Default client is unchanged (routing, cache key literal, explicit "default", onError arity)
 *  - Registering named clients (shorthand + full form, reserved name)
 *  - Selecting a client per request (routing + baseURL, no `client` key in axios config, unknown name)
 *  - Cache keys are scoped by client (two backends, prefix invalidation, manual id)
 *  - Per-client error parsing and error context
 *  - Global behaviour applies to every client (abort, cacheDefaults, retry, devtools, 401 via a session)
 * plus cleanup on unmount and `client` combined with `select`.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

import { useApi } from "../src/useApi";
import { useApiGet } from "../src/useApi.helpers";
import { createApi } from "../src/plugin";
import { useAbortController } from "../src/composables/useAbortController";
import { clearAllCache, invalidateCache, readCache } from "../src/features/cacheManager";
import { createAuthSession } from "../src/features/authSession";
import { createApiClient } from "../src/features/createInstance";
import { tokenManager, LocalStorageTokenStorage } from "../src/features/tokenManager";
import { setAuthMonitor } from "../src/features/monitor";
import { devtoolsBridge, __devtoolsInternals } from "../src/devtools";
import type { ApiError, ApiPluginOptions, UseApiOptions } from "../src/types";
import { fakeAdapter, useGlobalFakeAdapter, fullUrl } from "./features/authSession.fixtures";

function mockInstance(): AxiosInstance & { request: Mock } {
    return {
        request: vi.fn(),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
        defaults: { headers: { common: {} } },
    } as unknown as AxiosInstance & { request: Mock };
}

function ok(data: unknown = { ok: true }, status = 200) {
    return { data, status, statusText: "OK", headers: {}, config: {} };
}

function httpError(status: number, data: unknown = { message: `HTTP ${status}` }) {
    return Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        response: { status, data },
    });
}

let main: ReturnType<typeof mockInstance>;
let tools: ReturnType<typeof mockInstance>;

beforeEach(() => {
    clearAllCache();
    main = mockInstance();
    tools = mockInstance();
    main.request.mockResolvedValue(ok({ from: "main" }));
    tools.request.mockResolvedValue(ok({ from: "tools" }));
});

afterEach(() => {
    __devtoolsInternals().reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

type AnyReturn = ReturnType<typeof useApi>;

function mountApi(
    url: string,
    options: UseApiOptions = {},
    plugin: Partial<ApiPluginOptions> = {},
): { api: AnyReturn; wrapper: ReturnType<typeof mount> } {
    let api!: AnyReturn;
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useApi(url, options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: main, clients: { tools }, ...plugin })] } },
    );
    return { api, wrapper };
}

/** Last config passed to an instance's request(). */
function lastConfig(instance: { request: Mock }): AxiosRequestConfig & Record<string, unknown> {
    return instance.request.mock.calls.at(-1)![0];
}

// ---------------------------------------------------------------------------
// Default client is unchanged
// ---------------------------------------------------------------------------

describe("useApi clients — default client unchanged", () => {
    it("a request without client goes through the main axios", async () => {
        const { api } = mountApi("/users");
        await api.execute();

        expect(main.request).toHaveBeenCalledTimes(1);
        expect(tools.request).not.toHaveBeenCalled();
        expect(api.data.value).toEqual({ from: "main" });
    });

    it("keeps the 1.8 cache key format byte-for-byte", async () => {
        const { api } = mountApi("/users", { params: { page: 1 }, cache: true });
        await api.execute();
        expect(api.cacheKey.value).toBe('auto:GET:/users:{"page":1}:');
    });

    it('client: "default" behaves exactly like no client, cache key included', async () => {
        const { api } = mountApi("/users", { params: { page: 1 }, cache: true, client: "default" });
        await api.execute();

        expect(main.request).toHaveBeenCalledTimes(1);
        expect(api.cacheKey.value).toBe('auto:GET:/users:{"page":1}:');
    });

    it("calls the global onError with exactly two arguments for a default-client failure", async () => {
        const onError = vi.fn();
        main.request.mockRejectedValue(httpError(500));
        const { api } = mountApi("/users", {}, { onError });
        await api.execute();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0]).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// Registering named clients
// ---------------------------------------------------------------------------

describe("useApi clients — registration", () => {
    it("accepts the shorthand and the full { axios, errorParser } form", async () => {
        const mcp = mockInstance();
        mcp.request.mockResolvedValue(ok({ from: "mcp" }));
        const viaTools = mountApi("/a", { client: "tools" }, { clients: { tools, mcp: { axios: mcp } } });
        const viaMcp = mountApi("/b", { client: "mcp" }, { clients: { tools, mcp: { axios: mcp } } });

        await viaTools.api.execute();
        await viaMcp.api.execute();

        expect(viaTools.api.data.value).toEqual({ from: "tools" });
        expect(viaMcp.api.data.value).toEqual({ from: "mcp" });
    });

    it("throws at createApi when clients uses the reserved name default", () => {
        expect(() => createApi({ axios: main, clients: { default: tools } })).toThrow(/"default" is reserved/);
    });

    it("treats a real axios instance as the shorthand form", async () => {
        const adapter = fakeAdapter(() => ({ data: { from: "real" } }));
        const real = axios.create({ adapter });
        const { api } = mountApi("/r", { client: "real" }, { clients: { real } });

        await api.execute();
        expect(api.data.value).toEqual({ from: "real" });
    });
});

// ---------------------------------------------------------------------------
// Selecting a client per request
// ---------------------------------------------------------------------------

describe("useApi clients — selection", () => {
    it("useApiGet with client: tools sends through the tools instance, resolved against its baseURL", async () => {
        const adapter = fakeAdapter(() => ({ data: [{ id: 1 }] }));
        const toolsReal = axios.create({ baseURL: "https://tools.example", adapter });
        let api!: ReturnType<typeof useApiGet>;
        mount(
            defineComponent({
                setup() {
                    api = useApiGet("/brands", { client: "tools", immediate: true });
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: main, clients: { tools: toolsReal } })] } },
        );
        await flushPromises();

        expect(main.request).not.toHaveBeenCalled();
        expect(adapter.calls.map(fullUrl)).toEqual(["https://tools.example/brands"]);
        expect(api.data.value).toEqual([{ id: 1 }]);
    });

    it("never forwards client to axios — not from options, not from execute()", async () => {
        const { api } = mountApi("/brands", { client: "tools" });
        await api.execute();
        expect("client" in lastConfig(tools)).toBe(false);

        // An untyped caller passing client per call must not leak it either
        await api.execute({ client: "tools" } as unknown as Parameters<AnyReturn["execute"]>[0]);
        expect("client" in lastConfig(tools)).toBe(false);
    });

    it("throws for an unknown client, naming it and listing the registered ones", () => {
        expect(() => mountApi("/x", { client: "nope" })).toThrow(
            '[vue-muza-use] Unknown API client "nope". Registered: default, tools',
        );
    });

    it("applies select to a named-client response", async () => {
        const { api } = mountApi("/brands", {
            client: "tools",
            select: (raw) => (raw as { from: string }).from.toUpperCase(),
        });
        await api.execute();
        expect(api.data.value).toBe("TOOLS");
    });
});

// ---------------------------------------------------------------------------
// Cache keys are scoped by client
// ---------------------------------------------------------------------------

describe("useApi clients — cache", () => {
    it("keeps separate entries for the same path on two backends", async () => {
        const viaMain = mountApi("/brands", { cache: true });
        const viaTools = mountApi("/brands", { cache: true, client: "tools" });
        await viaMain.api.execute();
        await viaTools.api.execute();

        expect(viaTools.api.cacheKey.value).toBe("auto@tools:GET:/brands::");
        expect(readCache("auto:GET:/brands::")).toEqual({ from: "main" });
        expect(readCache("auto@tools:GET:/brands::")).toEqual({ from: "tools" });

        // Second round is served from each client's own entry
        await viaMain.api.execute();
        await viaTools.api.execute();
        expect(main.request).toHaveBeenCalledTimes(1);
        expect(tools.request).toHaveBeenCalledTimes(1);
        expect(viaMain.api.data.value).toEqual({ from: "main" });
        expect(viaTools.api.data.value).toEqual({ from: "tools" });
    });

    it("prefix invalidation for one client leaves the other alone", async () => {
        await mountApi("/brands", { cache: true }).api.execute();
        await mountApi("/brands", { cache: true, client: "tools", params: { page: 2 } }).api.execute();

        invalidateCache({ prefix: "auto@tools:GET:/brands" });

        expect(readCache('auto@tools:GET:/brands:{"page":2}:')).toBeNull();
        expect(readCache("auto:GET:/brands::")).toEqual({ from: "main" });
    });

    it("uses a manual cache id verbatim for a named client", async () => {
        const { api } = mountApi("/brands", { cache: { id: "brands" }, client: "tools" });
        await api.execute();
        expect(api.cacheKey.value).toBe("brands");
    });
});

// ---------------------------------------------------------------------------
// Per-client error parsing and error context
// ---------------------------------------------------------------------------

describe("useApi clients — errors", () => {
    const toolsParser = (): ApiError => ({ message: "tools parser", status: 418 });
    const globalParser = (): ApiError => ({ message: "global parser", status: 499 });

    it("uses the client's own errorParser", async () => {
        tools.request.mockRejectedValue(httpError(500));
        const { api } = mountApi("/x", { client: "tools" }, {
            clients: { tools: { axios: tools, errorParser: toolsParser } },
            errorParser: globalParser,
        });
        await api.execute();
        expect(api.error.value).toEqual({ message: "tools parser", status: 418 });
    });

    it("falls back to the global errorParser for a client without one", async () => {
        tools.request.mockRejectedValue(httpError(500));
        const { api } = mountApi("/x", { client: "tools" }, { errorParser: globalParser });
        await api.execute();
        expect(api.error.value).toEqual({ message: "global parser", status: 499 });
    });

    it("falls back to the built-in parser when there is no parser at all", async () => {
        tools.request.mockRejectedValue(httpError(404, { message: "Not here" }));
        const { api } = mountApi("/x", { client: "tools" });
        await api.execute();
        expect(api.error.value).toMatchObject({ status: 404, message: "Not here" });
    });

    it("passes { client } as the third onError argument for a named client", async () => {
        const onError = vi.fn();
        const original = httpError(503);
        tools.request.mockRejectedValue(original);
        const { api } = mountApi("/x", { client: "tools" }, { onError });
        await api.execute();

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }), original, { client: "tools" });
    });

    it("respects skipErrorNotification for a named client", async () => {
        const onError = vi.fn();
        tools.request.mockRejectedValue(httpError(500));
        const { api } = mountApi("/x", { client: "tools", skipErrorNotification: true }, { onError });
        await api.execute();
        expect(onError).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Global behaviour applies to every client
// ---------------------------------------------------------------------------

describe("useApi clients — global behaviour", () => {
    it("global abort cancels an in-flight named-client request", async () => {
        let seenSignal: AbortSignal | undefined;
        tools.request.mockImplementation((config: AxiosRequestConfig) => new Promise((_, reject) => {
            seenSignal = config.signal as AbortSignal;
            seenSignal.addEventListener("abort", () => {
                reject(Object.assign(new Error("canceled"), { isAxiosError: true, code: "ERR_CANCELED" }));
            });
        }));
        const { api } = mountApi("/slow", { client: "tools" });

        const pending = api.execute();
        await flushPromises();
        useAbortController().abort();

        await expect(pending).resolves.toBeNull();
        expect(seenSignal?.aborted).toBe(true);
        expect(api.error.value).toBeNull();
    });

    it("applies globalOptions.cacheDefaults to a named-client entry", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(0);
        const { api } = mountApi("/brands", { cache: true, client: "tools" }, {
            globalOptions: { cacheDefaults: { staleTime: 60_000 } },
        });

        await api.execute();
        vi.setSystemTime(59_000);
        await api.execute();
        expect(tools.request).toHaveBeenCalledTimes(1); // still fresh

        vi.setSystemTime(61_000);
        await api.execute();
        expect(tools.request).toHaveBeenCalledTimes(2); // 60 s stale time elapsed
        expect(api.cacheKey.value).toBe("auto@tools:GET:/brands::");
    });

    it("applies global retry options, every attempt through the named instance", async () => {
        tools.request.mockRejectedValue(httpError(503));
        const { api } = mountApi("/flaky", { client: "tools" }, { globalOptions: { retry: 2, retryDelay: 0 } });

        await api.execute();

        expect(tools.request).toHaveBeenCalledTimes(3);
        expect(main.request).not.toHaveBeenCalled();
        expect(api.error.value).toMatchObject({ status: 503 });
    });

    it("reports a named-client request to devtools like any other, with its scoped cache key", async () => {
        __devtoolsInternals().setExpected(true);
        const start = vi.spyOn(devtoolsBridge, "onRequestStart");
        const end = vi.spyOn(devtoolsBridge, "onRequestEnd");
        const viaMain = mountApi("/brands", { cache: true });
        const viaTools = mountApi("/brands", { cache: true, client: "tools" });

        await viaMain.api.execute();
        await viaTools.api.execute();

        const [mainRecord, toolsRecord] = start.mock.calls.map(([record]) => record);
        expect(Object.keys(toolsRecord).sort()).toEqual(Object.keys(mainRecord).sort());
        expect(toolsRecord).toMatchObject({ url: "/brands", method: "GET", cacheKey: "auto@tools:GET:/brands::" });
        expect(end).toHaveBeenCalledTimes(2);
        expect(end.mock.calls[1][1]).toMatchObject({ status: "success", statusCode: 200 });
    });

    it("retries a 401 through the named instance when it is attached to an auth session", async () => {
        tokenManager.setStorage(new LocalStorageTokenStorage());
        tokenManager.setTokens({ accessToken: "old" });
        setAuthMonitor(() => {});
        const { adapter, restore } = useGlobalFakeAdapter((config) => {
            if (fullUrl(config) === "https://insights.example/auth/refresh") return { data: { accessToken: "new" } };
            return config.headers.get("Authorization") === "Bearer new"
                ? { data: { brands: 3 } }
                : { status: 401, data: {} };
        });
        try {
            const session = createAuthSession({ refresh: { url: "/auth/refresh", baseURL: "https://insights.example" } });
            const toolsApi = createApiClient({ baseURL: "https://tools.example", authSession: session });
            const { api } = mountApi("/brands", { client: "tools" }, { clients: { tools: toolsApi } });

            await api.execute();

            expect(api.data.value).toEqual({ brands: 3 });
            expect(adapter.calls.map(fullUrl)).toEqual([
                "https://tools.example/brands",
                "https://insights.example/auth/refresh",
                "https://tools.example/brands",
            ]);
        } finally {
            restore();
            tokenManager.clearTokens();
        }
    });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("useApi clients — cleanup", () => {
    it("aborts an in-flight named-client request on unmount", async () => {
        let seenSignal: AbortSignal | undefined;
        tools.request.mockImplementation((config: AxiosRequestConfig) => new Promise(() => {
            seenSignal = config.signal as AbortSignal;
        }));
        const { api, wrapper } = mountApi("/slow", { client: "tools" });

        void api.execute();
        await flushPromises();
        wrapper.unmount();

        expect(seenSignal?.aborted).toBe(true);
    });
});
