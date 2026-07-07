import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";
import { useApi } from "./useApi";
import { createApi } from "./plugin";

const mockAxios = {
    request: vi.fn(),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

beforeEach(() => {
    vi.clearAllMocks();
    (mockAxios.request as unknown as Mock).mockResolvedValue({ data: "ok", status: 200 });
});

describe("useApi — initialLoading defaults", () => {
    it("loading is true during the initial debounce window when immediate: true", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x", { immediate: true, debounce: 50 });
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        // execute() is debounced — no sync setLoading(true) yet.
        // startLoading must have defaulted to `immediate`.
        expect(api.loading.value).toBe(true);
    });

    it("explicit initialLoading: false wins over immediate", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x", { immediate: true, debounce: 50, initialLoading: false });
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        expect(api.loading.value).toBe(false);
    });

    it("loading is false by default (no immediate)", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x");
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        expect(api.loading.value).toBe(false);
    });
});
