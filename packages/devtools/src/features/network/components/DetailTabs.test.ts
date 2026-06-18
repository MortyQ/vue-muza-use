import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DetailTabs from "./DetailTabs.vue";

describe("DetailTabs — hasError", () => {
    it("Response tab has no error class when hasError is false", () => {
        const wrapper = mount(DetailTabs, {
            props: { activeTab: "split", hasError: false },
        });
        const responseBtn = wrapper.findAll("button").find(b => b.text().replace("●", "").trim() === "Response");
        expect(responseBtn?.classes()).not.toContain("tab-btn--error");
    });

    it("Response tab has error class when hasError is true", () => {
        const wrapper = mount(DetailTabs, {
            props: { activeTab: "split", hasError: true },
        });
        const responseBtn = wrapper.findAll("button").find(b => b.text().includes("Response"));
        expect(responseBtn?.classes()).toContain("tab-btn--error");
    });

    it("Response tab shows dot indicator when hasError is true", () => {
        const wrapper = mount(DetailTabs, {
            props: { activeTab: "split", hasError: true },
        });
        const responseBtn = wrapper.findAll("button").find(b => b.text().includes("Response"));
        expect(responseBtn?.text()).toContain("●");
    });

    it("other tabs are not affected when hasError is true", () => {
        const wrapper = mount(DetailTabs, {
            props: { activeTab: "split", hasError: true },
        });
        const splitBtn = wrapper.findAll("button").find(b => b.text() === "Split");
        expect(splitBtn?.classes()).not.toContain("tab-btn--error");
    });

    it("hasError defaults to no error styling when prop is omitted", () => {
        const wrapper = mount(DetailTabs, {
            props: { activeTab: "split" },
        });
        const responseBtn = wrapper.findAll("button").find(b => b.text().includes("Response"));
        expect(responseBtn?.classes()).not.toContain("tab-btn--error");
    });
});
