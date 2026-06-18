import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import DataPane from "./DataPane.vue";
import type { ApiError } from "../../../shared/types/index";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadResponseFormat: vi.fn().mockResolvedValue("json"),
    saveResponseFormat: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

const mockError: ApiError = { message: "Not found", status: 404 };

describe("DataPane — error banner", () => {
    it("shows no error banner when error is null", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: { ok: true }, error: null },
        });
        await flushPromises();
        expect(wrapper.find(".error-banner").exists()).toBe(false);
    });

    it("shows no error banner when error prop is absent", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: { ok: true } },
        });
        await flushPromises();
        expect(wrapper.find(".error-banner").exists()).toBe(false);
    });

    it("shows error banner when error is provided", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: null, error: mockError },
        });
        await flushPromises();
        expect(wrapper.find(".error-banner").exists()).toBe(true);
    });

    it("shows error status code in banner", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: null, error: mockError },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("404");
    });

    it("shows error message in banner", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: null, error: mockError },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("Not found");
    });

    it("still renders pane body when both error and data are present", async () => {
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: { detail: "bad input" }, error: mockError },
        });
        await flushPromises();
        expect(wrapper.find(".error-banner").exists()).toBe(true);
        expect(wrapper.find(".pane-body").exists()).toBe(true);
    });

    it("shows zero-status error without status prefix when status is 0", async () => {
        const networkError: ApiError = { message: "Network Error", status: 0 };
        const wrapper = mount(DataPane, {
            props: { title: "Response", data: null, error: networkError },
        });
        await flushPromises();
        expect(wrapper.find(".error-banner").exists()).toBe(true);
        expect(wrapper.text()).toContain("Network Error");
    });
});
