/**
 * CacheOptions.freshFor — two-tier SWR freshness
 *
 * Entry age tiers on a cache hit with swr: true:
 *  - age < freshFor            → serve cache, NO network, revalidating stays false
 *  - freshFor <= age < stale   → current SWR behavior: serve cache + background revalidation
 *  - age >= staleTime          → entry deleted, normal request with loading
 *
 * Default freshFor: 0 → every SWR hit revalidates (behavior before this feature).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";

import { useApi } from "./useApi";
import { createApi } from "./plugin";
import { clearAllCache, invalidateCache } from "./features/cacheManager";
import type { UseApiOptions } from "./types";

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

function mountApi(options: UseApiOptions = {}): { api: AnyUseApiReturn; wrapper: ReturnType<typeof mount> } {
    let api!: AnyUseApiReturn;
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useApi("/test", options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios })] } },
    );
    return { api, wrapper };
}

function resolveWith(data: unknown, status = 200) {
    requestMock.mockResolvedValueOnce({ data, status });
}

/**
 * Populate the cache entry, then shift Date.now() by `ageMs` so the next
 * read sees an entry of exactly that age. Clears axios call history so
 * assertions count only requests made AFTER aging.
 *
 * NOTE: `staleTime` is stored at WRITE time — pass the same cache options
 * the reading instance will use when the test depends on a custom staleTime.
 */
async function populateCacheAged(cache: UseApiOptions["cache"], data: unknown, ageMs: number): Promise<void> {
    resolveWith(data);
    await mountApi({ cache }).api.execute();
    const base = Date.now();
    requestMock.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(base + ageMs);
}

describe("useApi — freshFor: default (no freshFor)", () => {
    it("swr: true without freshFor revalidates on every hit (current behavior preserved)", async () => {
        await populateCacheAged("test", "stale", 1);

        resolveWith("fresh");
        const { api } = mountApi({ cache: { id: "test", swr: true } });
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(api.data.value).toBe("fresh");
    });
});

describe("useApi — freshFor: fresh hit (age < freshFor)", () => {
    it("serves cached data and makes NO request", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        await api.execute();

        expect(requestMock).not.toHaveBeenCalled();
        expect(api.data.value).toBe("stale");
    });

    it("revalidating and loading stay false", async () => {
        await populateCacheAged("test", "stale", 5_000);

        let resolveHang!: (v: unknown) => void;
        requestMock.mockReturnValueOnce(new Promise((resolve) => { resolveHang = resolve; }));

        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        const pending = api.execute();

        // Synchronously after execute(): a background revalidation would have
        // flipped `revalidating` to true here — freshness must prevent that.
        expect(api.revalidating.value).toBe(false);
        expect(api.loading.value).toBe(false);

        resolveHang({ data: "never-used", status: 200 });
        await pending;
        expect(requestMock).not.toHaveBeenCalled();
    });

    it("accepts a duration string for freshFor", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: "10s" } });
        await api.execute();

        expect(requestMock).not.toHaveBeenCalled();
        expect(api.data.value).toBe("stale");
    });

    it("execute() resolves with the cached data", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        const result = await api.execute();

        expect(result).toBe("stale");
    });
});

describe("useApi — freshFor: aged hit (freshFor <= age < staleTime)", () => {
    it("serves cached data and revalidates in the background", async () => {
        await populateCacheAged("test", "stale", 15_000);

        resolveWith("fresh");
        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(api.data.value).toBe("fresh");
        expect(api.revalidating.value).toBe(false);
    });
});

describe("useApi — freshFor: edge cases", () => {
    it("freshFor + staleTime: Infinity — fresh within the window, revalidates after", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const fresh = mountApi({ cache: { id: "test", swr: true, freshFor: "1h", staleTime: Infinity } });
        await fresh.api.execute();
        expect(requestMock).not.toHaveBeenCalled();

        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 3_600_000);
        resolveWith("fresh");
        const aged = mountApi({ cache: { id: "test", swr: true, freshFor: "1h", staleTime: Infinity } });
        await aged.api.execute();
        expect(requestMock).toHaveBeenCalledTimes(1);
    });

    it("freshFor > staleTime — fresh until hard expiry, then a normal loading request", async () => {
        // staleTime is stored at write time — populate with the same options
        const cache = { id: "test", swr: true, freshFor: 60_000, staleTime: 10_000 };
        await populateCacheAged(cache, "stale", 5_000);

        // age 5s < staleTime 10s → still fresh (freshFor 60s dominates)
        const fresh = mountApi({ cache });
        await fresh.api.execute();
        expect(requestMock).not.toHaveBeenCalled();

        // age 15s > staleTime 10s → entry expired → normal request
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10_000);
        resolveWith("fresh");
        const expired = mountApi({ cache });
        await expired.api.execute();
        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(expired.api.data.value).toBe("fresh");
    });

    it("freshFor with swr: false — behavior unchanged (hit serves cache without a request)", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api } = mountApi({ cache: { id: "test", freshFor: 10_000 } });
        await api.execute();

        expect(requestMock).not.toHaveBeenCalled();
        expect(api.data.value).toBe("stale");
    });

    it("per-call override: execute({ cache }) with freshFor suppresses revalidation", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api } = mountApi({ lazy: true });
        await api.execute({ cache: { id: "test", swr: true, freshFor: 10_000 } });

        expect(requestMock).not.toHaveBeenCalled();
        expect(api.data.value).toBe("stale");
    });

    it("staleTime accepts a duration string", async () => {
        // written with staleTime "50ms" → entry age 200ms → expired → real request
        await populateCacheAged({ id: "test", staleTime: "50ms" }, "stale", 200);

        resolveWith("fresh");
        const { api } = mountApi({ cache: { id: "test", staleTime: "50ms" } });
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(api.data.value).toBe("fresh");
    });
});

describe("useApi — freshFor: cleanup", () => {
    it("no lingering requests after unmount following a fresh hit", async () => {
        await populateCacheAged("test", "stale", 5_000);

        const { api, wrapper } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        await api.execute();
        wrapper.unmount();
        await new Promise((r) => setTimeout(r, 0));

        expect(requestMock).not.toHaveBeenCalled();
    });
});

describe("useApi — freshFor: integration", () => {
    it("select is applied to fresh cache hits", async () => {
        await populateCacheAged("test", { name: "stale" }, 5_000);

        const { api } = mountApi({
            cache: { id: "test", swr: true, freshFor: 10_000 },
            select: (raw: unknown) => (raw as { name: string }).name.toUpperCase(),
        });
        await api.execute();

        expect(requestMock).not.toHaveBeenCalled();
        expect(api.data.value).toBe("STALE");
    });

    it("invalidateCache defeats freshness — next call is a real request", async () => {
        await populateCacheAged("test", "stale", 5_000);

        invalidateCache("test");

        resolveWith("fresh");
        const { api } = mountApi({ cache: { id: "test", swr: true, freshFor: 10_000 } });
        await api.execute();

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(api.data.value).toBe("fresh");
    });
});
