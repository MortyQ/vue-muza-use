import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TreeViewer from "./TreeViewer.vue";

describe("TreeViewer", () => {
    it("renders nothing for null value", () => {
        const wrapper = mount(TreeViewer, { props: { value: null } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders nothing for undefined value", () => {
        const wrapper = mount(TreeViewer, { props: { value: undefined } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders nothing for a primitive string (not an object)", () => {
        const wrapper = mount(TreeViewer, { props: { value: "hello" } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders a TreeNode for each top-level key of an object", () => {
        const wrapper = mount(TreeViewer, { props: { value: { a: 1, b: 2 } } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
    });

    it("renders a TreeNode for each item in an array", () => {
        const wrapper = mount(TreeViewer, { props: { value: [10, 20, 30] } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(3);
    });

    it("shows correct key labels from object", () => {
        const wrapper = mount(TreeViewer, { props: { value: { username: "alice" } } });
        expect(wrapper.text()).toContain("username");
        expect(wrapper.text()).toContain('"alice"');
    });

    it("shows numeric indices for array items", () => {
        const wrapper = mount(TreeViewer, { props: { value: ["x"] } });
        expect(wrapper.text()).toContain("0");
        expect(wrapper.text()).toContain('"x"');
    });

    it("omits a key whose value is undefined", () => {
        const wrapper = mount(TreeViewer, { props: { value: { a: 1, b: undefined } } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(1);
        expect(wrapper.text()).not.toContain("b");
    });

    it("renders an undefined array item as null", () => {
        const wrapper = mount(TreeViewer, { props: { value: [1, undefined] } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
        expect(wrapper.text()).toContain("null");
    });

    it("passes depth 0 to every top-level TreeNode", () => {
        const wrapper = mount(TreeViewer, { props: { value: { a: 1, b: 2 } } });
        const nodes = wrapper.findAllComponents({ name: "TreeNode" });
        expect(nodes.length).toBe(2);
        nodes.forEach((node) => {
            expect(node.props("depth")).toBe(0);
        });
    });
});
