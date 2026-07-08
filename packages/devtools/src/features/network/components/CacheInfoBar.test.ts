import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import CacheInfoBar from "./CacheInfoBar.vue";
import type { RequestRecord } from "../../../shared/types/index";

function makeRequest(over: Partial<RequestRecord> = {}): RequestRecord {
    return {
        id: "r1", instanceId: "i1", url: "/lists", method: "GET",
        startedAt: 1_000, duration: 40, status: "success", statusCode: 200,
        requestHeaders: {}, payload: null, queryParams: null, response: null,
        error: null, truncated: false, instanceOptions: undefined,
        cacheKey: 'auto:GET:/lists:{"page":1}:', cachedAt: Date.now(),
        ...over,
    };
}

const cache = { staleTime: 300_000, swr: true, freshFor: 10_000 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CacheInfoBar — key row", () => {
    it("renders the full cache key text", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.text()).toContain('auto:GET:/lists:{"page":1}:');
    });

    it("shows a prefix copy button for auto keys", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.find('[data-test="copy-prefix"]').exists()).toBe(true);
    });

    it("hides the prefix button for manual keys", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cacheKey: "my-manual-id" }), cache } });
        expect(w.find('[data-test="copy-prefix"]').exists()).toBe(false);
    });

    it("toggles the expanded class on key click", async () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        await w.find('[data-test="key-text"]').trigger("click");
        expect(w.find('[data-test="key-text"]').classes()).toContain("expanded");
    });

    it("renders no key row when cacheKey is absent", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cacheKey: undefined }), cache } });
        expect(w.find('[data-test="key-text"]').exists()).toBe(false);
    });

    it("collapses the expanded key when a different request is selected", async () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        await w.find('[data-test="key-text"]').trigger("click");
        expect(w.find('[data-test="key-text"]').classes()).toContain("expanded");

        await w.setProps({ request: makeRequest({ id: "r2" }) });
        expect(w.find('[data-test="key-text"]').classes()).not.toContain("expanded");
    });
});

describe("CacheInfoBar — config row", () => {
    it("renders humanized staleTime and freshFor and swr marker", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.text()).toContain("staleTime 5m");
        expect(w.text()).toContain("freshFor 10s");
        expect(w.text()).toContain("swr");
    });
});

describe("CacheInfoBar — countdown", () => {
    it("shows fresh state with remaining time inside the freshFor window", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 3_000 }), cache } });
        expect(w.text()).toMatch(/fresh/i);
        expect(w.text()).toContain("7s");
    });

    it("shows the swr window after freshFor elapses", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 20_000 }), cache } });
        expect(w.text()).toMatch(/stale in/i);
    });

    it("shows cached state (not swr wording) when swr is false", () => {
        const w = mount(CacheInfoBar, {
            props: { request: makeRequest({ cachedAt: Date.now() - 20_000 }), cache: { staleTime: 300_000, swr: false, freshFor: 0 } },
        });
        expect(w.text()).toMatch(/expires in/i);
    });

    it("shows expired after staleTime elapses", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 400_000 }), cache } });
        expect(w.text()).toMatch(/expired/i);
    });

    it("ticks: fresh flips to the swr window as time advances", async () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 9_500 }), cache } });
        expect(w.text()).toMatch(/fresh/i);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(w.text()).toMatch(/stale in/i);
    });

    it("renders no countdown when cachedAt is absent", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: undefined }), cache } });
        expect(w.find('[data-test="countdown"]').exists()).toBe(false);
    });

    it("clears its interval on unmount", () => {
        const clearSpy = vi.spyOn(globalThis, "clearInterval");
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        w.unmount();
        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
