import { describe, it, expect, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";
import { initDevtoolsStore, addRequest } from "../../../shared/store/devtoolsStore";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

function makeRequest(overrides: Partial<Parameters<typeof addRequest>[0]> = {}) {
    addRequest({
        id: `r-${Math.random()}`, instanceId: "i1", url: "/users", method: "GET",
        startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null,
        ...overrides,
    });
}

beforeEach(() => { initDevtoolsStore({}); });

describe("useNetworkFilter", () => {
    it("returns all requests when filters are empty", async () => {
        const { useNetworkFilter } = await import("./useNetworkFilter");
        makeRequest({ url: "/users" });
        makeRequest({ url: "/posts" });
        const { result } = withSetup(() => useNetworkFilter());
        expect(result.filteredRequests.value).toHaveLength(2);
    });

    it("filters by URL", async () => {
        const { useNetworkFilter } = await import("./useNetworkFilter");
        makeRequest({ url: "/users" });
        makeRequest({ url: "/posts" });
        const { result } = withSetup(() => useNetworkFilter());
        result.urlFilter.value = "user";
        await nextTick();
        expect(result.filteredRequests.value).toHaveLength(1);
        expect(result.filteredRequests.value[0].url).toBe("/users");
    });

    it("filters by status", async () => {
        const { useNetworkFilter } = await import("./useNetworkFilter");
        makeRequest({ id: "r1", status: "success" });
        makeRequest({ id: "r2", status: "pending" });
        const { result } = withSetup(() => useNetworkFilter());
        result.statusFilter.value = "success";
        await nextTick();
        expect(result.filteredRequests.value).toHaveLength(1);
        expect(result.filteredRequests.value[0].status).toBe("success");
    });

    it("filters by instance", async () => {
        const { useNetworkFilter } = await import("./useNetworkFilter");
        makeRequest({ id: "r1", instanceId: "i1" });
        makeRequest({ id: "r2", instanceId: "i2" });
        const { result } = withSetup(() => useNetworkFilter());
        result.instanceFilter.value = "i1";
        await nextTick();
        expect(result.filteredRequests.value).toHaveLength(1);
        expect(result.filteredRequests.value[0].instanceId).toBe("i1");
    });

    it("clearFilters resets all filters", async () => {
        const { useNetworkFilter } = await import("./useNetworkFilter");
        makeRequest({ url: "/users" });
        const { result } = withSetup(() => useNetworkFilter());
        result.urlFilter.value = "something";
        result.clearFilters();
        await nextTick();
        expect(result.urlFilter.value).toBe("");
        expect(result.statusFilter.value).toBe("all");
    });
});

describe("useRequestDetail", () => {
    it("selectedRequest is null when nothing selected", async () => {
        const { useRequestDetail } = await import("./useRequestDetail");
        const { result } = withSetup(() => useRequestDetail());
        expect(result.selectedRequest.value).toBeNull();
    });

    it("selectRequest sets the selected request", async () => {
        const { useRequestDetail } = await import("./useRequestDetail");
        makeRequest({ id: "r-fixed" });
        const { result } = withSetup(() => useRequestDetail());
        result.selectRequest("r-fixed");
        await nextTick();
        expect(result.selectedRequest.value?.id).toBe("r-fixed");
    });

    it("toggles payload format between json and kv", async () => {
        const { useRequestDetail } = await import("./useRequestDetail");
        const { result } = withSetup(() => useRequestDetail());
        expect(result.payloadFormat.value).toBe("json");
        result.togglePayloadFormat();
        expect(result.payloadFormat.value).toBe("kv");
        result.togglePayloadFormat();
        expect(result.payloadFormat.value).toBe("json");
    });

    it("toggles view mode between split / payload / response / headers", async () => {
        const { useRequestDetail } = await import("./useRequestDetail");
        const { result } = withSetup(() => useRequestDetail());
        expect(result.viewMode.value).toBe("split");
        result.setViewMode("payload");
        expect(result.viewMode.value).toBe("payload");
    });
});
