/**
 * Automatic cache keys + global cacheDefaults + prefix invalidation.
 *
 * Auto-key: when CacheOptions.id is omitted (or cache: true), the key is derived
 * from method + url + params + data at request time, so each distinct params/body
 * gets its own entry. cacheDefaults fills fields per-request but never activates
 * caching on its own.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";

import { useApi } from "./useApi";
import { createApi } from "./plugin";
import { clearAllCache, invalidateCache } from "./features/cacheManager";
import type { ApiPluginOptions, UseApiOptions } from "./types";

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

const requestMock = mockAxios.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetAllMocks();
    clearAllCache();
});

afterEach(() => {
    vi.restoreAllMocks();
});

type AnyUseApiReturn = ReturnType<typeof useApi>;

function mountApi(
    url: string,
    options: UseApiOptions = {},
    plugin: Partial<ApiPluginOptions> = {},
): { api: AnyUseApiReturn; wrapper: ReturnType<typeof mount> } {
    let api!: AnyUseApiReturn;
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useApi(url, options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios, ...plugin })] } },
    );
    return { api, wrapper };
}

function resolveWith(data: unknown, status = 200) {
    requestMock.mockResolvedValueOnce({ data, status });
}

describe("useApi — auto cache keys: default (no id)", () => {
    it("cache: true — same url+params served from cache on the second execute", async () => {
        resolveWith("v1");
        const { api } = mountApi("/users", { cache: true });
        await api.execute();
        expect(requestMock).toHaveBeenCalledTimes(1);

        await api.execute();
        expect(requestMock).toHaveBeenCalledTimes(1); // served from auto-keyed cache
        expect(api.data.value).toBe("v1");
    });

    it("cacheKey reflects the derived auto key (method + url + params + data)", async () => {
        resolveWith("ok");
        const { api } = mountApi("/users", { cache: true, params: { page: 1 } });
        await api.execute();

        expect(api.cacheKey.value).toBe('auto:GET:/users:{"page":1}:');
    });

    it("cacheKey is null before the first execute and when cache is absent", async () => {
        const { api } = mountApi("/users", { cache: true });
        expect(api.cacheKey.value).toBeNull();

        resolveWith("x");
        const plain = mountApi("/users", {});
        await plain.api.execute();
        expect(plain.api.cacheKey.value).toBeNull();
    });
});

describe("useApi — auto cache keys: distinct inputs", () => {
    it("different params produce different keys → separate fetches", async () => {
        resolveWith("page1");
        const { api } = mountApi("/products", { cache: true, lazy: true });
        await api.execute({ params: { page: 1 } });
        await api.execute({ params: { page: 1 } }); // cached
        expect(requestMock).toHaveBeenCalledTimes(1);

        resolveWith("page2");
        await api.execute({ params: { page: 2 } }); // different key → real request
        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(api.data.value).toBe("page2");
    });

    it("keys derived from data (body) — key-order-independent collision", async () => {
        resolveWith("first");
        const { api } = mountApi("/report", { method: "POST", cache: true, lazy: true });
        await api.execute({ data: { a: 1, b: 2 } });
        expect(requestMock).toHaveBeenCalledTimes(1);

        // structurally equal body, different key order + new object identity → same key
        await api.execute({ data: { b: 2, a: 1 } });
        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(api.data.value).toBe("first");
    });

    it("auto key uses the request method", async () => {
        resolveWith("ok");
        const { api } = mountApi("/report", { method: "POST", cache: true });
        await api.execute();
        expect(api.cacheKey.value?.startsWith("auto:POST:/report:")).toBe(true);
    });
});

describe("useApi — cacheDefaults: HARD RULE (never activates caching)", () => {
    it("cacheDefaults set but request has NO cache → fetches every time", async () => {
        resolveWith("a");
        resolveWith("b");
        const { api } = mountApi(
            "/users",
            {},
            { globalOptions: { cacheDefaults: { swr: true, staleTime: "6h" } } },
        );
        await api.execute();
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(api.cacheKey.value).toBeNull();
    });
});

describe("useApi — cacheDefaults: merge", () => {
    it("cache: true inherits staleTime default (still cached on second call)", async () => {
        resolveWith("v1");
        const { api } = mountApi(
            "/users",
            { cache: true },
            { globalOptions: { cacheDefaults: { staleTime: "6h" } } },
        );
        await api.execute();
        await api.execute();
        expect(requestMock).toHaveBeenCalledTimes(1);
    });

    it("composable cache overrides a default field per-field", async () => {
        // default staleTime 6h, composable overrides to 50ms → entry expires fast
        vi.useFakeTimers();
        try {
            resolveWith("stale");
            const { api } = mountApi(
                "/users",
                { cache: { staleTime: "50ms" } },
                { globalOptions: { cacheDefaults: { staleTime: "6h" } } },
            );
            await api.execute();

            vi.advanceTimersByTime(200);
            resolveWith("fresh");
            await api.execute();
            expect(requestMock).toHaveBeenCalledTimes(2); // expired → refetch
        } finally {
            vi.useRealTimers();
        }
    });

    it("per-call field overrides composable but keeps other composable fields (3-level per-field merge)", async () => {
        // composable: swr + freshFor 1h. per-call adds staleTime; swr/freshFor must survive.
        resolveWith("seed");
        const { api } = mountApi("/users", { cache: { swr: true, freshFor: "1h" }, lazy: true });
        await api.execute({ cache: { staleTime: "1d" } });

        // Within freshFor window: a second identical call must NOT hit the network
        // (proves swr+freshFor survived the per-call staleTime override).
        await api.execute({ cache: { staleTime: "1d" } });
        expect(requestMock).toHaveBeenCalledTimes(1);
    });

    it("cacheDefaults.id is ignored — request without id still auto-keys", async () => {
        resolveWith("ok");
        const { api } = mountApi(
            "/users",
            { cache: true, params: { page: 3 } },
            { globalOptions: { cacheDefaults: { id: "should-be-ignored" } as never } },
        );
        await api.execute();
        expect(api.cacheKey.value).toBe('auto:GET:/users:{"page":3}:');
    });

    it("string cache id + swr default → SWR behavior (background revalidation)", async () => {
        resolveWith("stale");
        await mountApi("/users", { cache: "manual" }).api.execute();

        resolveWith("fresh");
        const { api } = mountApi(
            "/users",
            { cache: "manual" },
            { globalOptions: { cacheDefaults: { swr: true } } },
        );
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(2); // SWR revalidated in background
        expect(api.data.value).toBe("fresh");
        expect(api.cacheKey.value).toBe("manual");
    });
});

describe("useApi — manual id still opts out of auto-keying", () => {
    it("uses the manual id verbatim regardless of params", async () => {
        resolveWith("ok");
        const { api } = mountApi("/users", { cache: { id: "fixed" }, params: { page: 9 } });
        await api.execute();
        expect(api.cacheKey.value).toBe("fixed");
    });
});

describe("useApi — invalidation of auto keys", () => {
    it("invalidateCache(cacheKey.value) busts the exact entry", async () => {
        resolveWith("v1");
        const { api } = mountApi("/users", { cache: true });
        await api.execute();
        const key = api.cacheKey.value!;

        invalidateCache(key);
        resolveWith("v2");
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(api.data.value).toBe("v2");
    });

    it("prefix invalidation busts every page of a list at once", async () => {
        const { api } = mountApi("/products", { cache: true, lazy: true });
        resolveWith("p1");
        await api.execute({ params: { page: 1 } });
        resolveWith("p2");
        await api.execute({ params: { page: 2 } });
        expect(requestMock).toHaveBeenCalledTimes(2);

        invalidateCache({ prefix: "auto:GET:/products" });

        resolveWith("p1-fresh");
        await api.execute({ params: { page: 1 } });
        resolveWith("p2-fresh");
        await api.execute({ params: { page: 2 } });
        expect(requestMock).toHaveBeenCalledTimes(4); // both pages refetched
    });
});

describe("useApi — cleanup", () => {
    it("no request after unmount following an auto-keyed cache hit", async () => {
        resolveWith("v1");
        const { api, wrapper } = mountApi("/users", { cache: true });
        await api.execute();
        requestMock.mockClear();

        await api.execute(); // cache hit, no network
        wrapper.unmount();
        await new Promise((r) => setTimeout(r, 0));

        expect(requestMock).not.toHaveBeenCalled();
    });
});
