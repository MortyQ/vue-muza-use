import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TreeNode from "./TreeNode.vue";

describe("TreeNode — primitives", () => {
    it("renders a string value with quotes", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "name", value: "Alice", depth: 0 } });
        expect(wrapper.text()).toContain('"Alice"');
    });

    it("renders a number value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "count", value: 42, depth: 0 } });
        expect(wrapper.text()).toContain("42");
    });

    it("renders a boolean value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "active", value: true, depth: 0 } });
        expect(wrapper.text()).toContain("true");
    });

    it("renders null value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "deleted", value: null, depth: 0 } });
        expect(wrapper.text()).toContain("null");
    });

    it("renders the key label", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "myKey", value: "val", depth: 0 } });
        expect(wrapper.text()).toContain("myKey");
    });

    it("hides the arrow for leaf nodes", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "x", value: 1, depth: 0 } });
        expect(wrapper.find(".tree-arrow").attributes("style")).toContain("visibility: hidden");
    });
});

describe("TreeNode — object", () => {
    it("renders Object badge with count", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1, b: 2 }, depth: 0 } });
        expect(wrapper.text()).toContain("Object {2}");
    });

    it("shows arrow as visible for objects", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.find(".tree-arrow").attributes("style") ?? "").not.toContain("visibility: hidden");
    });

    it("does not show children by default (collapsed)", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.text()).not.toContain('"a"');
    });

    it("expands children when arrow is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.text()).toContain("a");
        expect(wrapper.text()).toContain('"hello"');
    });

    it("expands children when badge is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.text()).toContain("a");
        expect(wrapper.text()).toContain('"hello"');
    });

    it("collapses when clicked again", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.text()).not.toContain('"hello"');
    });
});

describe("TreeNode — array", () => {
    it("renders Array badge with length", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "items", value: [1, 2, 3], depth: 0 } });
        expect(wrapper.text()).toContain("Array [3]");
    });

    it("expands array items with numeric index as key when badge clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "tags", value: ["a", "b"], depth: 0 } });
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.text()).toContain("0");
        expect(wrapper.text()).toContain('"a"');
        expect(wrapper.text()).toContain("1");
        expect(wrapper.text()).toContain('"b"');
    });
});

describe("TreeNode — depth indent", () => {
    it("applies paddingLeft based on depth", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "x", value: 1, depth: 3 } });
        const row = wrapper.find(".tree-row");
        expect(row.attributes("style")).toContain("padding-left: 42px");
    });
});
