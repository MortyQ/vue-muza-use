/**
 * execute() per-call config overrides
 *
 * Covers:
 *  - lifecycle callbacks (onBefore, onSuccess, onError, onFinish) merge with composable-level
 *  - cache per-call replaces composable-level
 *  - invalidateCache per-call merges with composable-level
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, type MaybeRefOrGetter } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { AxiosInstance, AxiosResponse } from "axios";
import { useApi } from "../useApi";
import { createApi } from "../plugin";
import { clearAllCache, readCache, writeCache } from "../features/cacheManager";
import type { UseApiOptions, ApiPluginOptions, UseApiReturn } from "../types";

// ---------------------------------------------------------------------------
// Shared mock & helpers
// ---------------------------------------------------------------------------

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

function mountApi<T = unknown>(
    options: UseApiOptions<T> = {},
    apiOptions: Partial<ApiPluginOptions> = {},
    url?: MaybeRefOrGetter<string | undefined>,
) {
    let result: UseApiReturn<T, unknown>;
    const Comp = defineComponent({
        setup() {
            result = useApi(url ?? "/test", options);
            return () => null;
        },
    });
    const wrapper = mount(Comp, {
        global: { plugins: [createApi({ axios: mockAxios, ...apiOptions })] },
    });
    return { result: result!, wrapper };
}

function makeResponse<T>(data: T, status = 200): AxiosResponse<T> {
    return { data, status, headers: {}, config: {} as never, statusText: "OK" };
}

function axiosError(status: number, message = "Error") {
    return Object.assign(new Error(message), {
        isAxiosError: true,
        response: { status, data: { message } },
        code: undefined as string | undefined,
    });
}

// ---------------------------------------------------------------------------

describe("execute() — per-call config", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAllCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Lifecycle callbacks — merge behavior
    // =========================================================================

    describe("callbacks — merge with composable-level", () => {
        it("onBefore: both composable-level and per-call fire in order", async () => {
            const order: string[] = [];
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi({ onBefore: () => order.push("composable") });
            await result.execute({ onBefore: () => order.push("per-call") });
            await flushPromises();

            expect(order).toEqual(["composable", "per-call"]);
        });

        it("onSuccess: both composable-level and per-call fire in order", async () => {
            const order: string[] = [];
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi({ onSuccess: () => order.push("composable") });
            await result.execute({ onSuccess: () => order.push("per-call") });
            await flushPromises();

            expect(order).toEqual(["composable", "per-call"]);
        });

        it("onError: both composable-level and per-call fire in order", async () => {
            const order: string[] = [];
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(500));

            const { result } = mountApi({ onError: () => order.push("composable") });
            await result.execute({ onError: () => order.push("per-call") });
            await flushPromises();

            expect(order).toEqual(["composable", "per-call"]);
        });

        it("onFinish: both composable-level and per-call fire in order", async () => {
            const order: string[] = [];
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi({ onFinish: () => order.push("composable") });
            await result.execute({ onFinish: () => order.push("per-call") });
            await flushPromises();

            expect(order).toEqual(["composable", "per-call"]);
        });

        it("onFinish: per-call fires even when no composable-level callback is set", async () => {
            const onFinish = vi.fn();
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi();
            await result.execute({ onFinish });
            await flushPromises();

            expect(onFinish).toHaveBeenCalledTimes(1);
        });

        it("onSuccess: per-call fires even when no composable-level callback is set", async () => {
            const onSuccess = vi.fn();
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ value: 42 }));

            const { result } = mountApi();
            await result.execute({ onSuccess });
            await flushPromises();

            expect(onSuccess).toHaveBeenCalledTimes(1);
            expect(onSuccess.mock.calls[0][0].data).toEqual({ value: 42 });
        });

        it("onError: per-call fires even when no composable-level callback is set", async () => {
            const onError = vi.fn();
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(404));

            const { result } = mountApi();
            await result.execute({ onError });
            await flushPromises();

            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError.mock.calls[0][0].status).toBe(404);
        });

        it("per-call callbacks do not fire on subsequent execute() calls without them", async () => {
            const perCallSuccess = vi.fn();
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi();

            await result.execute({ onSuccess: perCallSuccess });
            await flushPromises();
            expect(perCallSuccess).toHaveBeenCalledTimes(1);

            await result.execute();
            await flushPromises();
            expect(perCallSuccess).toHaveBeenCalledTimes(1); // no extra call
        });
    });

    // =========================================================================
    // cache — replace behavior
    // =========================================================================

    describe("cache — per-call replaces composable-level", () => {
        it("per-call cache key is used when specified, composable-level key is ignored", async () => {
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ v: 1 }));

            const { result } = mountApi({ cache: "composable-key" });
            await result.execute({ cache: "per-call-key" });
            await flushPromises();

            expect(readCache("per-call-key")).toEqual({ v: 1 });
            expect(readCache("composable-key")).toBeNull();
        });

        it("per-call cache hit short-circuits the request", async () => {
            writeCache("per-call-key", { cached: true }, 60_000);
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ cached: false }));

            const { result } = mountApi();
            await result.execute({ cache: "per-call-key" });
            await flushPromises();

            expect(mockAxios.request).not.toHaveBeenCalled();
            expect(result.data.value).toEqual({ cached: true });
        });

        it("no cache is used when per-call cache is not set and composable-level is absent", async () => {
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ v: 2 }));

            const { result } = mountApi();
            await result.execute();
            await flushPromises();

            expect(readCache("any-key")).toBeNull();
            expect(mockAxios.request).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // invalidateCache — merge behavior
    // =========================================================================

    describe("invalidateCache — per-call merges with composable-level", () => {
        it("per-call invalidateCache fires on success even without composable-level", async () => {
            writeCache("users-list", [{ id: 1 }], 60_000);
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi({ method: "POST" });
            await result.execute({ invalidateCache: "users-list" });
            await flushPromises();

            expect(readCache("users-list")).toBeNull();
        });

        it("per-call invalidateCache accepts an array", async () => {
            writeCache("a", { a: 1 }, 60_000);
            writeCache("b", { b: 2 }, 60_000);
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi();
            await result.execute({ invalidateCache: ["a", "b"] });
            await flushPromises();

            expect(readCache("a")).toBeNull();
            expect(readCache("b")).toBeNull();
        });

        it("per-call key overrides composable-level key — only per-call is invalidated", async () => {
            writeCache("composable-key", { c: 1 }, 60_000);
            writeCache("per-call-key", { p: 2 }, 60_000);
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi({ invalidateCache: "composable-key" });
            await result.execute({ invalidateCache: "per-call-key" });
            await flushPromises();

            expect(readCache("per-call-key")).toBeNull();
            expect(readCache("composable-key")).toEqual({ c: 1 }); // not touched
        });

        it("invalidateCache does NOT fire on error", async () => {
            writeCache("users-list", [{ id: 1 }], 60_000);
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(500));

            const { result } = mountApi();
            await result.execute({ invalidateCache: "users-list" });
            await flushPromises();

            expect(readCache("users-list")).toEqual([{ id: 1 }]); // still in cache
        });

        it("per-call invalidateCache does not affect subsequent calls without it", async () => {
            writeCache("users-list", [{ id: 1 }], 60_000);
            mockAxios.request = vi.fn().mockResolvedValue(makeResponse({ ok: true }));

            const { result } = mountApi();

            await result.execute({ invalidateCache: "users-list" });
            await flushPromises();
            expect(readCache("users-list")).toBeNull();

            writeCache("users-list", [{ id: 2 }], 60_000);

            await result.execute(); // no invalidateCache
            await flushPromises();
            expect(readCache("users-list")).toEqual([{ id: 2 }]); // still intact
        });
    });

    // =========================================================================
    // retry / retryDelay / retryStatusCodes / skipErrorNotification — per-call
    // =========================================================================

    describe("retry options — per-call override", () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it("per-call retry overrides composable-level (no retry → retry: 1)", async () => {
            mockAxios.request = vi.fn()
                .mockRejectedValueOnce(axiosError(500))
                .mockResolvedValueOnce(makeResponse({ ok: true }));

            const { result } = mountApi({ retry: false });
            const promise = result.execute({ retry: 1, retryDelay: 0 });
            await vi.runAllTimersAsync();
            await promise;

            expect(mockAxios.request).toHaveBeenCalledTimes(2);
            expect(result.data.value).toEqual({ ok: true });
        });

        it("per-call retry: false suppresses composable-level retry", async () => {
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(500));

            const { result } = mountApi({ retry: 3, retryDelay: 100 });
            const promise = result.execute({ retry: false });
            await vi.runAllTimersAsync();
            await promise;

            expect(mockAxios.request).toHaveBeenCalledTimes(1); // no retries
        });

        it("per-call retryStatusCodes overrides composable-level", async () => {
            mockAxios.request = vi.fn()
                .mockRejectedValueOnce(axiosError(404))
                .mockResolvedValueOnce(makeResponse({ ok: true }));

            const { result } = mountApi({ retry: 1, retryDelay: 0, retryStatusCodes: [500] });
            // composable would NOT retry 404, but per-call allows it
            const promise = result.execute({ retryStatusCodes: [404] });
            await vi.runAllTimersAsync();
            await promise;

            expect(mockAxios.request).toHaveBeenCalledTimes(2);
        });
    });

    describe("skipErrorNotification — per-call override", () => {
        it("per-call skipErrorNotification: true suppresses globalErrorHandler", async () => {
            const globalOnError = vi.fn();
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(500));

            const { result } = mountApi({}, { onError: globalOnError });
            await result.execute({ skipErrorNotification: true });
            await flushPromises();

            expect(globalOnError).not.toHaveBeenCalled();
        });

        it("per-call skipErrorNotification: false restores globalErrorHandler when composable suppresses it", async () => {
            const globalOnError = vi.fn();
            mockAxios.request = vi.fn().mockRejectedValue(axiosError(500));

            const { result } = mountApi({ skipErrorNotification: true }, { onError: globalOnError });
            await result.execute({ skipErrorNotification: false });
            await flushPromises();

            expect(globalOnError).toHaveBeenCalledTimes(1);
        });
    });
});
