import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PayloadPane from "./PayloadPane.vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPayloadFormat: vi.fn().mockResolvedValue("kv"),
    savePayloadFormat: vi.fn().mockResolvedValue(undefined),
}));

import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPayloadFormat).mockResolvedValue("kv");
});

describe("PayloadPane — query params section", () => {
    it("shows 'No params' when queryParams is null", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No params");
    });

    it("shows 'No params' when queryParams is empty object", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: {}, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No params");
    });

    it("renders query params when present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { q: "search" }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("q");
        expect(wrapper.text()).toContain('"search"');
    });

    it("shows the param count badge when params present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { a: 1, b: 2, c: 3 }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("3");
    });
});

describe("PayloadPane — body section", () => {
    it("shows 'No body' when payload is null", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No body");
    });

    it("renders body when payload is present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { name: "Alice" }, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("name");
        expect(wrapper.text()).toContain('"Alice"');
    });

    it("shows truncated warning when truncated is true and payload present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { x: 1 }, truncated: true },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("[truncated]");
    });
});

describe("PayloadPane — format toggle", () => {
    it("loads saved format on mount", async () => {
        vi.mocked(loadPayloadFormat).mockResolvedValue("json");
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { q: "x" }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(loadPayloadFormat).toHaveBeenCalledOnce();
        // KV button should not be active (format is json)
        const kvBtn = wrapper.find(".pane-action--active");
        expect(kvBtn.exists()).toBe(false);
    });

    it("saves format when toggled", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { x: 1 }, truncated: false },
        });
        await flushPromises();
        await wrapper.find("button.pane-action").trigger("click"); // KV toggle
        expect(savePayloadFormat).toHaveBeenCalledWith("json");
    });
});
