import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PayloadPane from "./PayloadPane.vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPayloadFormat: vi.fn().mockResolvedValue("kv"),
    savePayloadFormat: vi.fn().mockResolvedValue(undefined),
}));

import { loadPayloadFormat } from "../../../shared/storage/devtoolsStorage";

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
    // _payloadFormatLoaded is module-scoped — vi.resetModules() + dynamic import
    // gives each test a fresh module instance with the flag reset to false.
    let PayloadPaneComp: typeof PayloadPane;
    let loadFmt: ReturnType<typeof vi.fn>;
    let saveFmt: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        loadFmt = vi.fn().mockResolvedValue("kv");
        saveFmt = vi.fn().mockResolvedValue(undefined);
        vi.doMock("../../../shared/storage/devtoolsStorage", () => ({
            loadPayloadFormat: loadFmt,
            savePayloadFormat: saveFmt,
        }));
        const mod = await import("./PayloadPane.vue");
        PayloadPaneComp = mod.default as typeof PayloadPane;
    });

    it("loads saved format on mount", async () => {
        loadFmt.mockResolvedValue("json");
        const wrapper = mount(PayloadPaneComp, {
            props: { queryParams: { q: "x" }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(loadFmt).toHaveBeenCalledOnce();
        // format is "json" → KV button should not be active
        expect(wrapper.find(".pane-action--active").exists()).toBe(false);
    });

    it("saves format when toggled", async () => {
        const wrapper = mount(PayloadPaneComp, {
            props: { queryParams: null, payload: { x: 1 }, truncated: false },
        });
        await flushPromises();
        await wrapper.find("button.pane-action").trigger("click");
        expect(saveFmt).toHaveBeenCalledWith("json");
    });

    it("shows an icon (not the 'KV' text) with a descriptive title on the toggle button", async () => {
        const wrapper = mount(PayloadPaneComp, {
            props: { queryParams: { q: "x" }, payload: null, truncated: false },
        });
        await flushPromises();
        const toggle = wrapper.find("button.pane-action");
        expect(toggle.text()).not.toBe("KV");
        expect(toggle.find(".iconify, svg").exists()).toBe(true);
        expect(toggle.attributes("title")).toBe("Switch to JSON view");
    });
});
