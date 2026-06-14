import { describe, it, expect, beforeEach } from "vitest";
import { createApp, defineComponent } from "vue";
import { initDevtoolsStore, registerInstance } from "../store/devtoolsStore";
import { registerTab, unregisterTab } from "../plugins/tabRegistry";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp(
        defineComponent({
            setup() {
                result = composable();
                return () => null;
            },
        }),
    );
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => {
    initDevtoolsStore({});
});

describe("useDevtoolsStore", () => {
    it("returns instances and requests computed refs", async () => {
        const { useDevtoolsStore } = await import("./useDevtoolsStore");
        const { result } = withSetup(() => useDevtoolsStore());
        expect(result.instances.value).toBeDefined();
        expect(result.requests.value).toBeDefined();
    });

    it("reflects store mutations reactively", async () => {
        const { useDevtoolsStore } = await import("./useDevtoolsStore");
        const { result } = withSetup(() => useDevtoolsStore());
        registerInstance("id-1", "/users", {
            authMode: "default",
            cache: undefined,
            retry: false,
            poll: 0,
            immediate: true,
            lazy: false,
        });
        expect(result.instances.value.has("id-1")).toBe(true);
    });

    it("exposes getRequestsByInstance", async () => {
        const { useDevtoolsStore } = await import("./useDevtoolsStore");
        const { result } = withSetup(() => useDevtoolsStore());
        expect(typeof result.getRequestsByInstance).toBe("function");
    });
});

describe("useTabRegistry", () => {
    it("returns registeredTabs computed ref", async () => {
        const { useTabRegistry } = await import("./useTabRegistry");
        const stubComponent = defineComponent({ template: "<div/>" });
        registerTab({ id: "test-tab", label: "Test", component: stubComponent, order: 1 });
        const { result, unmount } = withSetup(() => useTabRegistry());
        expect(result.registeredTabs.value.find((t) => t.id === "test-tab")).toBeDefined();
        unmount();
        unregisterTab("test-tab");
    });

    it("returns tabs sorted by order", async () => {
        const { useTabRegistry } = await import("./useTabRegistry");
        const stubComponent = defineComponent({ template: "<div/>" });
        registerTab({ id: "tab-a", label: "A", component: stubComponent, order: 2 });
        registerTab({ id: "tab-b", label: "B", component: stubComponent, order: 1 });
        const { result, unmount } = withSetup(() => useTabRegistry());
        expect(result.registeredTabs.value[0].id).toBe("tab-b");
        expect(result.registeredTabs.value[1].id).toBe("tab-a");
        unmount();
        unregisterTab("tab-a");
        unregisterTab("tab-b");
    });
});
