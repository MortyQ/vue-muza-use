import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { registeredTabs, registerTab, unregisterTab } from "./tabRegistry";

const stubComponent = defineComponent({ template: "<div/>" });

function reset() {
    // unregister all to isolate tests
    registeredTabs.value.forEach((t) => unregisterTab(t.id));
}

beforeEach(reset);

describe("registerTab", () => {
    it("adds a tab to the registry", () => {
        registerTab({ id: "network", label: "Network", component: stubComponent, order: 1 });
        expect(registeredTabs.value).toHaveLength(1);
        expect(registeredTabs.value[0].id).toBe("network");
    });

    it("ignores duplicate tab ids", () => {
        registerTab({ id: "network", label: "Network", component: stubComponent });
        registerTab({ id: "network", label: "Network 2", component: stubComponent });
        expect(registeredTabs.value).toHaveLength(1);
    });

    it("assigns auto order when not provided", () => {
        registerTab({ id: "a", label: "A", component: stubComponent });
        expect(registeredTabs.value[0].order).toBeDefined();
    });
});

describe("registeredTabs — sorted by order", () => {
    it("returns tabs sorted by order ascending", () => {
        registerTab({ id: "c", label: "C", component: stubComponent, order: 30 });
        registerTab({ id: "a", label: "A", component: stubComponent, order: 10 });
        registerTab({ id: "b", label: "B", component: stubComponent, order: 20 });
        const ids = registeredTabs.value.map((t) => t.id);
        expect(ids).toEqual(["a", "b", "c"]);
    });
});

describe("unregisterTab", () => {
    it("removes a tab by id", () => {
        registerTab({ id: "x", label: "X", component: stubComponent });
        unregisterTab("x");
        expect(registeredTabs.value.find((t) => t.id === "x")).toBeUndefined();
    });

    it("silently ignores unknown id", () => {
        expect(() => unregisterTab("nonexistent")).not.toThrow();
    });
});
