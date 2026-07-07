import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";
import { useApi } from "./useApi";
import { createApi } from "./plugin";
import type { UseApiOptions } from "./types";

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

function mountApi(options: UseApiOptions = {}) {
    return mount(
        defineComponent({
            setup() {
                useApi("/x", options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios })] } },
    );
}

describe("useApi — poll visibility listener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (mockAxios.request as unknown as Mock).mockResolvedValue({ data: "ok", status: 200 });
    });

    it("registers no visibilitychange listener when poll is not configured", () => {
        const spy = vi.spyOn(document, "addEventListener");
        mountApi();
        const calls = spy.mock.calls.filter(([evt]) => evt === "visibilitychange");
        expect(calls).toHaveLength(0);
        spy.mockRestore();
    });

    it("registers the listener when poll is configured, and removes it on unmount", () => {
        const addSpy = vi.spyOn(document, "addEventListener");
        const removeSpy = vi.spyOn(document, "removeEventListener");
        const wrapper = mountApi({ poll: 5000 });
        expect(addSpy.mock.calls.filter(([evt]) => evt === "visibilitychange")).toHaveLength(1);

        wrapper.unmount();
        expect(removeSpy.mock.calls.filter(([evt]) => evt === "visibilitychange")).toHaveLength(1);
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
