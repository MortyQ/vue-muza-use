import { describe, it, expect, beforeEach } from "vitest";
import { createApp, nextTick, defineComponent } from "vue";
import { initDevtoolsStore, registerInstance } from "../../../shared/store/devtoolsStore";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

const defaultOpts = { authMode: "default" as const, cache: undefined, retry: false, poll: 0, immediate: true, lazy: false };

beforeEach(() => { initDevtoolsStore({}); });

describe("useInstanceFilter", () => {
    it("returns all instances when searchTerm is empty", async () => {
        const { useInstanceFilter } = await import("./useInstanceFilter");
        registerInstance("a", "/users", defaultOpts);
        registerInstance("b", "/posts", defaultOpts);
        const { result } = withSetup(() => useInstanceFilter());
        expect(result.filteredInstances.value).toHaveLength(2);
    });

    it("filters instances by URL", async () => {
        const { useInstanceFilter } = await import("./useInstanceFilter");
        registerInstance("a", "/users", defaultOpts);
        registerInstance("b", "/posts", defaultOpts);
        const { result } = withSetup(() => useInstanceFilter());
        result.searchTerm.value = "user";
        await nextTick();
        expect(result.filteredInstances.value).toHaveLength(1);
        expect(result.filteredInstances.value[0].url).toBe("/users");
    });
});

describe("useInstanceDetail", () => {
    it("selectedInstance is null initially", async () => {
        const { useInstanceDetail } = await import("./useInstanceDetail");
        const { result } = withSetup(() => useInstanceDetail());
        expect(result.selectedInstance.value).toBeNull();
    });

    it("selectInstance sets the selected instance", async () => {
        const { useInstanceDetail } = await import("./useInstanceDetail");
        registerInstance("id-1", "/users", defaultOpts);
        const { result } = withSetup(() => useInstanceDetail());
        result.selectInstance("id-1");
        await nextTick();
        expect(result.selectedInstance.value?.id).toBe("id-1");
    });

    it("clearSelection resets to null", async () => {
        const { useInstanceDetail } = await import("./useInstanceDetail");
        registerInstance("id-1", "/users", defaultOpts);
        const { result } = withSetup(() => useInstanceDetail());
        result.selectInstance("id-1");
        result.clearSelection();
        await nextTick();
        expect(result.selectedInstance.value).toBeNull();
    });
});

describe("useInstancesTab", () => {
    it("exposes searchTerm, filteredInstances, selectedInstance, selectInstance", async () => {
        const { useInstancesTab } = await import("./useInstancesTab");
        const { result } = withSetup(() => useInstancesTab());
        expect(result.searchTerm).toBeDefined();
        expect(result.filteredInstances).toBeDefined();
        expect(result.selectedInstance).toBeDefined();
        expect(typeof result.selectInstance).toBe("function");
    });
});
