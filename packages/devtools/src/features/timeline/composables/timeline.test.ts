import { describe, it, expect, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";
import { initDevtoolsStore, registerInstance, addRequest, updateRequest } from "../../../shared/store/devtoolsStore";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

const defaultOpts = { authMode: "default" as const, cache: undefined, retry: false, poll: 0, immediate: true, lazy: false };

beforeEach(() => { initDevtoolsStore({}); });

describe("useTimelineFilter", () => {
    it("statusFilter defaults to 'all'", async () => {
        const { useTimelineFilter } = await import("./useTimelineFilter");
        const { result } = withSetup(() => useTimelineFilter());
        expect(result.statusFilter.value).toBe("all");
    });

    it("zoom defaults to 1 and can be increased/decreased", async () => {
        const { useTimelineFilter } = await import("./useTimelineFilter");
        const { result } = withSetup(() => useTimelineFilter());
        expect(result.zoom.value).toBe(1);
        result.zoomIn();
        expect(result.zoom.value).toBeGreaterThan(1);
        result.zoomOut();
        result.zoomOut();
        expect(result.zoom.value).toBeLessThan(1);
    });

    it("zoom is clamped to [0.1, 10]", async () => {
        const { useTimelineFilter } = await import("./useTimelineFilter");
        const { result } = withSetup(() => useTimelineFilter());
        for (let i = 0; i < 30; i++) result.zoomIn();
        expect(result.zoom.value).toBe(10);
        for (let i = 0; i < 30; i++) result.zoomOut();
        expect(result.zoom.value).toBe(0.1);
    });
});

describe("useTimelineTab", () => {
    it("instanceTimelines is empty when no instances", async () => {
        const { useTimelineTab } = await import("./useTimelineTab");
        const { result } = withSetup(() => useTimelineTab());
        expect(result.instanceTimelines.value).toHaveLength(0);
    });

    it("includes instance with its requests", async () => {
        const { useTimelineTab } = await import("./useTimelineTab");
        registerInstance("i1", "/users", defaultOpts);
        addRequest({ id: "r1", instanceId: "i1", url: "/users", method: "GET",
            startedAt: 1000, status: "success", statusCode: null, requestHeaders: {}, payload: null });
        const { result } = withSetup(() => useTimelineTab());
        await nextTick();
        expect(result.instanceTimelines.value).toHaveLength(1);
        expect(result.instanceTimelines.value[0].requests).toHaveLength(1);
    });

    it("timeRange covers all requests", async () => {
        const { useTimelineTab } = await import("./useTimelineTab");
        addRequest({ id: "r1", instanceId: "i1", url: "/u", method: "GET",
            startedAt: 1000, status: "success", statusCode: null, requestHeaders: {}, payload: null });
        updateRequest("r1", { status: "success", statusCode: 200, response: null, duration: 200 });
        addRequest({ id: "r2", instanceId: "i1", url: "/u", method: "GET",
            startedAt: 2000, status: "success", statusCode: null, requestHeaders: {}, payload: null });
        updateRequest("r2", { status: "success", statusCode: 200, response: null, duration: 100 });
        const { result } = withSetup(() => useTimelineTab());
        await nextTick();
        expect(result.timeRange.value.start).toBe(1000);
        expect(result.timeRange.value.end).toBeGreaterThanOrEqual(2100);
    });
});
