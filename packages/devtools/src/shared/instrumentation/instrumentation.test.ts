import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../store/devtoolsStore", () => ({
    registerInstance: vi.fn(),
    unregisterInstance: vi.fn(),
    updateInstanceState: vi.fn(),
    addRequest: vi.fn(),
    updateRequest: vi.fn(),
}));

import {
    registerInstance,
    unregisterInstance,
    updateInstanceState,
    addRequest,
    updateRequest,
} from "../store/devtoolsStore";

import { onInstanceCreated, onInstanceDestroyed, onStateUpdate } from "./instanceTracker";
import { onRequestStart, onRequestEnd } from "./requestTracker";

beforeEach(() => { vi.clearAllMocks(); });

describe("instanceTracker", () => {
    it("onInstanceCreated calls registerInstance", () => {
        const opts = { authMode: "default" as const, cache: undefined, retry: false, poll: 0, immediate: true, lazy: false };
        onInstanceCreated("id-1", "/users", opts);
        expect(registerInstance).toHaveBeenCalledWith("id-1", "/users", opts);
    });

    it("onInstanceDestroyed calls unregisterInstance", () => {
        onInstanceDestroyed("id-1");
        expect(unregisterInstance).toHaveBeenCalledWith("id-1");
    });

    it("onStateUpdate calls updateInstanceState", () => {
        onStateUpdate("id-1", { loading: true });
        expect(updateInstanceState).toHaveBeenCalledWith("id-1", { loading: true });
    });
});

describe("requestTracker", () => {
    it("onRequestStart calls addRequest", () => {
        const record = { id: "r1", instanceId: "id-1", url: "/users", method: "GET",
            startedAt: 1000, status: "pending" as const, statusCode: null, requestHeaders: {}, payload: null, queryParams: null, instanceOptions: undefined };
        onRequestStart(record);
        expect(addRequest).toHaveBeenCalledWith(record);
    });

    it("onRequestEnd calls updateRequest", () => {
        const result = { status: "success" as const, statusCode: 200, response: {}, duration: 50 };
        onRequestEnd("r1", result);
        expect(updateRequest).toHaveBeenCalledWith("r1", result);
    });
});
