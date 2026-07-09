import { describe, it, expect, beforeEach } from "vitest";
import {
    initDevtoolsStore,
    registerInstance,
    unregisterInstance,
    updateInstanceState,
    addRequest,
    updateRequest,
    flagRequestAuthRetry,
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
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        expect(requests.value).toHaveLength(1);
        expect(requests.value[0].id).toBe("r1");
    });

    it("evicts oldest when maxHistory is exceeded", () => {
        for (let i = 0; i < 6; i++) {
            addRequest({ id: `r${i}`, instanceId: null, url: "/u", method: "GET",
                startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        }
        expect(requests.value).toHaveLength(5);
        expect(requests.value[0].id).toBe("r1");
    });
});

describe("addRequest — payload truncation", () => {
    it("truncates payload exceeding maxPayloadSize, keeping the first maxPayloadSize chars", () => {
        const bigPayload = "x".repeat(200);
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "POST",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: bigPayload, queryParams: null });
        const stored = requests.value[0].payload as string;
        expect(requests.value[0].truncated).toBe(true);
        expect(typeof stored).toBe("string");
        // Starts with the first 100 chars (the configured test limit), not a replacement message
        expect(stored.startsWith('"' + "x".repeat(99))).toBe(true);
        expect(stored).toContain("bytes truncated");
    });

    it("does not truncate payload within maxPayloadSize", () => {
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "POST",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: { x: 1 }, queryParams: null });
        expect(requests.value[0].truncated).toBe(false);
        expect(requests.value[0].payload).toEqual({ x: 1 });
    });

    it("truncates queryParams that exceed maxPayloadSize", () => {
        const bigParams = { q: "a".repeat(200) };
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {},
            payload: null, queryParams: bigParams });
        expect(requests.value[0].truncated).toBe(true);
        expect(typeof requests.value[0].queryParams).toBe("string");
    });
});

describe("updateRequest", () => {
    beforeEach(() => {
        addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
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

    it("stores error.details into response when present", () => {
        const body = { code: "INTERNAL_ERROR", message: "Internal server error" };
        updateRequest("r1", {
            status: "error",
            error: { message: "Internal server error", status: 500, details: body },
            statusCode: 500,
            duration: 30,
        });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.response).toEqual(body);
    });

    it("leaves response null when error has no details", () => {
        updateRequest("r1", { status: "error", error: { message: "fail", status: 500 }, statusCode: 500, duration: 30 });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.response).toBeNull();
    });

    it("updates to aborted", () => {
        updateRequest("r1", { status: "aborted", duration: 10 });
        expect(requests.value.find(r => r.id === "r1")!.status).toBe("aborted");
    });

    it("ignores unknown request id", () => {
        expect(() => updateRequest("unknown", { status: "aborted", duration: 0 })).not.toThrow();
    });

    it("merges requestHeaders and responseHeaders on success", () => {
        updateRequest("r1", {
            status: "success", statusCode: 200, response: null, duration: 50,
            requestHeaders: { Accept: "application/json" },
            responseHeaders: { "content-type": "application/json" },
        });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.requestHeaders).toEqual({ Accept: "application/json" });
        expect(r.responseHeaders).toEqual({ "content-type": "application/json" });
    });

    it("merges requestHeaders and responseHeaders on error", () => {
        updateRequest("r1", {
            status: "error", error: { message: "fail", status: 500 }, statusCode: 500, duration: 30,
            requestHeaders: { Accept: "application/json" },
            responseHeaders: { "content-type": "text/plain" },
        });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.requestHeaders).toEqual({ Accept: "application/json" });
        expect(r.responseHeaders).toEqual({ "content-type": "text/plain" });
    });

    it("keeps the start-time requestHeaders when the result omits them", () => {
        updateRequest("r1", { status: "success", statusCode: 200, response: null, duration: 50 });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.requestHeaders).toEqual({});
        expect(r.responseHeaders).toBeUndefined();
    });
});

describe("payload normalization (FormData / Blob)", () => {
    it("stores a FormData payload as a plain object with file descriptors", () => {
        const form = new FormData();
        form.append("title", "hi");
        form.append("doc", new File(["abc"], "doc.pdf", { type: "application/pdf" }));
        addRequest({ id: "r1", instanceId: null, url: "/upload", method: "POST",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: form, queryParams: null });
        const r = requests.value[0];
        expect(r.truncated).toBe(false);
        expect(r.payload).toEqual({ title: "hi", doc: 'file "doc.pdf" (application/pdf, 3 B)' });
    });

    it("stores a Blob response as a descriptor string", () => {
        addRequest({ id: "r1", instanceId: null, url: "/download", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        updateRequest("r1", {
            status: "success", statusCode: 200,
            response: new Blob(["x".repeat(80)], { type: "application/pdf" }),
            duration: 10,
        });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.response).toBe("blob (application/pdf, 80 B)");
        expect(r.truncated).toBe(false);
    });
});

describe("flagRequestAuthRetry", () => {
    beforeEach(() => {
        addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
    });

    it("sets authRetried on the record", () => {
        flagRequestAuthRetry("r1");
        expect(requests.value.find(r => r.id === "r1")!.authRetried).toBe(true);
    });

    it("ignores unknown request ids", () => {
        expect(() => flagRequestAuthRetry("unknown")).not.toThrow();
        expect(requests.value.find(r => r.id === "r1")!.authRetried).toBeUndefined();
    });

    it("survives a subsequent success update", () => {
        flagRequestAuthRetry("r1");
        updateRequest("r1", { status: "success", statusCode: 200, response: null, duration: 50 });
        const r = requests.value.find(r => r.id === "r1")!;
        expect(r.status).toBe("success");
        expect(r.authRetried).toBe(true);
    });

    it("survives a subsequent error update", () => {
        flagRequestAuthRetry("r1");
        updateRequest("r1", { status: "error", error: { message: "fail", status: 500 }, statusCode: 500, duration: 30 });
        expect(requests.value.find(r => r.id === "r1")!.authRetried).toBe(true);
    });
});

describe("clearRequests", () => {
    it("removes all requests", () => {
        addRequest({ id: "r1", instanceId: null, url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        clearRequests();
        expect(requests.value).toHaveLength(0);
    });
});

describe("getRequestsByInstance", () => {
    it("returns requests filtered by instanceId", () => {
        addRequest({ id: "r1", instanceId: "a", url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        addRequest({ id: "r2", instanceId: "b", url: "/u", method: "GET",
            startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
        expect(getRequestsByInstance("a")).toHaveLength(1);
        expect(getRequestsByInstance("a")[0].id).toBe("r1");
    });
});

describe("cache metadata threading", () => {
    it("addRequest preserves cacheKey on the stored record", () => {
        addRequest({
            id: "r-ck", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null,
            cacheKey: 'auto:GET:/lists:{"page":1}:',
        });
        const rec = requests.value.find((r) => r.id === "r-ck")!;
        expect(rec.cacheKey).toBe('auto:GET:/lists:{"page":1}:');
    });

    it("updateRequest merges cachedAt from a success result", () => {
        addRequest({
            id: "r-ca", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null, cacheKey: "manual",
        });
        updateRequest("r-ca", { status: "success", statusCode: 200, response: {}, duration: 40, cachedAt: 1234567 });
        const rec = requests.value.find((r) => r.id === "r-ca")!;
        expect(rec.cachedAt).toBe(1234567);
    });

    it("success result without cachedAt leaves the field undefined on the record", () => {
        addRequest({
            id: "r-nc", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null, cacheKey: null,
        });
        updateRequest("r-nc", { status: "success", statusCode: 200, response: {}, duration: 40 });
        const rec = requests.value.find((r) => r.id === "r-nc")!;
        expect(rec.cachedAt).toBeUndefined();
    });

    it("cacheKey survives an aborted update", () => {
        addRequest({
            id: "r-ab", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null,
            cacheKey: 'auto:GET:/lists:{"page":1}:',
        });
        updateRequest("r-ab", { status: "aborted", duration: 5 });
        const rec = requests.value.find((r) => r.id === "r-ab")!;
        expect(rec.cacheKey).toBe('auto:GET:/lists:{"page":1}:');
    });
});
