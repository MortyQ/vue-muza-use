import { describe, it, expect, beforeEach } from "vitest";
import {
    initDevtoolsStore,
    registerInstance,
    unregisterInstance,
    updateInstanceState,
    addRequest,
    updateRequest,
    clearRequests,
    getRequestsByInstance,
    instances,
    requests,
} from "./devtoolsStore";

beforeEach(() => {
    initDevtoolsStore({ maxHistory: 5, maxPayloadSize: 100 });
});

describe("registerInstance / unregisterInstance", () => {
    it("adds an instance to the store", () => {
        registerInstance("id-1", "/users", {
            authMode: "default", cache: undefined, retry: false,
            poll: 0, immediate: true, lazy: false,
        });
        expect(instances.value.has("id-1")).toBe(true);
        expect(instances.value.get("id-1")!.url).toBe("/users");
    });

    it("removes an instance from the store", () => {
        registerInstance("id-1", "/users", {
            authMode: "default", cache: undefined, retry: false,
            poll: 0, immediate: true, lazy: false,
        });
        unregisterInstance("id-1");
        expect(instances.value.has("id-1")).toBe(false);
    });
});

describe("updateInstanceState", () => {
    it("merges partial state into the instance", () => {
        registerInstance("id-1", "/users", {
            authMode: "default", cache: undefined, retry: false,
            poll: 0, immediate: true, lazy: false,
        });
        updateInstanceState("id-1", { loading: true });
        expect(instances.value.get("id-1")!.state.loading).toBe(true);
    });

    it("ignores unknown instance ids", () => {
        expect(() => updateInstanceState("unknown", { loading: true })).not.toThrow();
    });
});

describe("addRequest — circular buffer", () => {
    it("adds a request record", () => {
        addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
        expect(requests.value).toHaveLength(1);
        expect(requests.value[0].id).toBe("r1");
    });

    it("evicts oldest when maxHistory is exceeded", () => {
        for (let i = 0; i < 6; i++) {
            addRequest({ id: `r${i}`, instanceId: null, url: "/u", method: "GET",
                startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
        }
        expect(requests.value).toHaveLength(5);
        expect(requests.value[0].id).toBe("r1");
    });
});

describe("addRequest — payload truncation", () => {
    it("truncates payload exceeding maxPayloadSize, keeping the first maxPayloadSize chars", () => {
        const bigPayload = "x".repeat(200);
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "POST",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: bigPayload });
        const stored = requests.value[0].payload as string;
        expect(requests.value[0].truncated).toBe(true);
        expect(typeof stored).toBe("string");
        // Starts with the first 100 chars (the configured test limit), not a replacement message
        expect(stored.startsWith('"' + "x".repeat(99))).toBe(true);
        expect(stored).toContain("bytes truncated");
    });

    it("does not truncate payload within maxPayloadSize", () => {
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "POST",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: { x: 1 } });
        expect(requests.value[0].truncated).toBe(false);
        expect(requests.value[0].payload).toEqual({ x: 1 });
    });
});

describe("updateRequest", () => {
    beforeEach(() => {
        addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
    });

    it("updates to success", () => {
        updateRequest("r1", { status: "success", statusCode: 200, response: { data: 1 }, duration: 50 });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.status).toBe("success");
        expect(r.statusCode).toBe(200);
        expect(r.duration).toBe(50);
    });

    it("updates to error", () => {
        updateRequest("r1", { status: "error", error: { message: "fail", status: 500 }, statusCode: 500, duration: 30 });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.status).toBe("error");
        expect(r.error?.message).toBe("fail");
    });

    it("updates to aborted", () => {
        updateRequest("r1", { status: "aborted", duration: 10 });
        expect(requests.value.find(r => r.id === "r1")!.status).toBe("aborted");
    });

    it("ignores unknown request id", () => {
        expect(() => updateRequest("unknown", { status: "aborted", duration: 0 })).not.toThrow();
    });
});

describe("clearRequests", () => {
    it("removes all requests", () => {
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
        clearRequests();
        expect(requests.value).toHaveLength(0);
    });
});

describe("getRequestsByInstance", () => {
    it("returns requests filtered by instanceId", () => {
        addRequest({ id: "r1", instanceId: "a", url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
        addRequest({ id: "r2", instanceId: "b", url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });
        expect(getRequestsByInstance("a")).toHaveLength(1);
        expect(getRequestsByInstance("a")[0].id).toBe("r1");
    });
});
