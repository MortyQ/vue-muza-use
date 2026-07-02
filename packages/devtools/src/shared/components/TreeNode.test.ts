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
    it("renders a key:value preview badge", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1, b: 2 }, depth: 0 } });
        expect(wrapper.find(".tree-badge").text()).toBe("{a: 1, b: 2}");
    });

    it("truncates the preview to the first 3 keys with an ellipsis", () => {
        const wrapper = mount(TreeNode, {
            props: { nodeKey: "obj", value: { a: 1, b: 2, c: 3, d: 4 }, depth: 0 },
        });
        expect(wrapper.find(".tree-badge").text()).toBe("{a: 1, b: 2, c: 3, …}");
    });

    it("formats string, null, nested object, and nested array values in the preview", () => {
        const wrapper = mount(TreeNode, {
            props: {
                nodeKey: "obj",
                value: { s: "hello", n: null, o: { x: 1 }, arr: [1, 2] },
                depth: 0,
            },
        });
        expect(wrapper.find(".tree-badge").text()).toBe('{s: "hello", n: null, o: {…}, …}');
    });

    it("omits keys with an undefined value from the preview and expanded list", async () => {
        const wrapper = mount(TreeNode, {
            props: { nodeKey: "data", value: { a: 1, skipped: undefined }, depth: 0 },
        });
        expect(wrapper.find(".tree-badge").text()).toBe("{a: 1}");
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
        expect(wrapper.text()).not.toContain("skipped");
    });

    it("shows arrow as visible for objects", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.find(".tree-arrow").attributes("style") ?? "").not.toContain("visibility: hidden");
    });

    it("does not show children by default (collapsed)", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(1);
    });

    it("expands children when arrow is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
    });

    it("expands children when badge is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
    });

    it("collapses when clicked again", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.findAll(".tree-node")).toHaveLength(1);
    });
});

describe("TreeNode — array", () => {
    it("renders Array badge with length and a preview of the first 2 items", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "items", value: [1, 2, 3], depth: 0 } });
        expect(wrapper.find(".tree-badge").text()).toBe("Array [3] [1, 2, …]");
    });

    it("omits the ellipsis when there are 2 or fewer items", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "items", value: [1, 2], depth: 0 } });
        expect(wrapper.find(".tree-badge").text()).toBe("Array [2] [1, 2]");
    });

    it("renders an undefined array item as null in the preview and expanded list", async () => {
        const wrapper = mount(TreeNode, {
            props: { nodeKey: "items", value: [1, undefined, 3], depth: 0 },
        });
        expect(wrapper.find(".tree-badge").text()).toBe("Array [3] [1, null, …]");
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.text()).toContain("null");
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
