/**
 * useApi — loading state on cache hits.
 *
 * Regression for: `immediate: true` (or `initialLoading: true`) presets
 * `loading = true` at state creation, but the cache-hit path in executeRequest
 * returned early without ever clearing it — loading stayed true forever while
 * data was served from cache and no request was made. Affected plain cache hits,
 * fresh SWR hits (freshFor) and stale SWR hits (background revalidation).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { AxiosInstance } from "axios";
import { useApi } from "./useApi";
import { createApi } from "./plugin";
import { clearAllCache } from "./features/cacheManager";
import type { UseApiOptions, UseApiReturn } from "./types";

const mockAxios = {
    request: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

const requestMock = mockAxios.request as unknown as Mock;

function mountApi(options: UseApiOptions<unknown>) {
    let result!: UseApiReturn<unknown, unknown>;
    const wrapper = mount(defineComponent({
        setup() {
            result = useApi("/kpi", options);
            return () => null;
        },
    }), { global: { plugins: [createApi({ axios: mockAxios })] } });
    return { result, wrapper };
}

const baseOpts: UseApiOptions<unknown> = {
    method: "POST",
    data: () => ({ vendor: "x" }),
    immediate: true,
};

/** Mount once with a cold cache to populate the auto-keyed entry, then unmount. */
async function warmCache(cache: UseApiOptions<unknown>["cache"]) {
    const { wrapper } = mountApi({ ...baseOpts, cache });
    await flushPromises();
    wrapper.unmount();
    requestMock.mockClear();
}

describe("useApi — loading on cache hit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAllCache();
        requestMock.mockResolvedValue({ data: { kpi: 42 }, status: 200, headers: {}, config: {} });
    });

    describe("when immediate:true hits a warm plain cache", () => {
        it("should serve cached data with loading false and no request", async () => {
            await warmCache(true);

            const { result, wrapper } = mountApi({ ...baseOpts, cache: true });
            await flushPromises();

            expect(requestMock).not.toHaveBeenCalled();
            expect(result.data.value).toEqual({ kpi: 42 });
            expect(result.loading.value).toBe(false);
            wrapper.unmount();
        });
    });

    describe("when immediate:true hits a fresh SWR entry (age < freshFor)", () => {
        it("should serve cached data with loading false, no revalidation request", async () => {
            const cache = { swr: true, freshFor: "1h", staleTime: "1d" } as const;
            await warmCache(cache);

            const { result, wrapper } = mountApi({ ...baseOpts, cache });
            await flushPromises();

            expect(requestMock).not.toHaveBeenCalled();
            expect(result.data.value).toEqual({ kpi: 42 });
            expect(result.loading.value).toBe(false);
            expect(result.revalidating.value).toBe(false);
            wrapper.unmount();
        });
    });

    describe("when immediate:true hits a stale SWR entry (background revalidation)", () => {
        it("should keep loading false during and after revalidation", async () => {
            const cache = { swr: true } as const; // freshFor 0 → always revalidate
            await warmCache(cache);

            // Deferred response so the mid-revalidation state is observable
            let resolveRequest!: (v: unknown) => void;
            requestMock.mockImplementation(
                () => new Promise((resolve) => { resolveRequest = resolve; }),
            );

            const { result, wrapper } = mountApi({ ...baseOpts, cache });
            await flushPromises();

            // Mid-flight: cached data shown, revalidating — but never "loading"
            expect(requestMock).toHaveBeenCalledTimes(1);
            expect(result.data.value).toEqual({ kpi: 42 });
            expect(result.loading.value).toBe(false);
            expect(result.revalidating.value).toBe(true);

            resolveRequest({ data: { kpi: 43 }, status: 200, headers: {}, config: {} });
            await flushPromises();

            expect(result.data.value).toEqual({ kpi: 43 });
            expect(result.loading.value).toBe(false);
            expect(result.revalidating.value).toBe(false);
            wrapper.unmount();
        });
    });

    describe("when initialLoading:true is set explicitly (lazy + manual execute)", () => {
        it("should clear loading on cache hit", async () => {
            await warmCache(true);

            const { result, wrapper } = mountApi({
                method: "POST",
                data: () => ({ vendor: "x" }),
                lazy: true,
                initialLoading: true,
                cache: true,
            });
            expect(result.loading.value).toBe(true);

            await result.execute();

            expect(requestMock).not.toHaveBeenCalled();
            expect(result.data.value).toEqual({ kpi: 42 });
            expect(result.loading.value).toBe(false);
            wrapper.unmount();
        });
    });

    describe("default behavior (unchanged)", () => {
        it("lazy manual execute() cache hit keeps loading false", async () => {
            await warmCache(true);

            const { result, wrapper } = mountApi({
                method: "POST",
                data: () => ({ vendor: "x" }),
                lazy: true,
                cache: true,
            });
            await result.execute();

            expect(requestMock).not.toHaveBeenCalled();
            expect(result.data.value).toEqual({ kpi: 42 });
            expect(result.loading.value).toBe(false);
            wrapper.unmount();
        });

        it("cold cache + immediate:true still shows loading during the request", async () => {
            let resolveRequest!: (v: unknown) => void;
            requestMock.mockImplementation(
                () => new Promise((resolve) => { resolveRequest = resolve; }),
            );

            const { result, wrapper } = mountApi({ ...baseOpts, cache: true });
            expect(result.loading.value).toBe(true);

            await flushPromises();

            resolveRequest({ data: { kpi: 42 }, status: 200, headers: {}, config: {} });
            await flushPromises();

            expect(result.loading.value).toBe(false);
            expect(result.data.value).toEqual({ kpi: 42 });
            wrapper.unmount();
        });
    });
});
