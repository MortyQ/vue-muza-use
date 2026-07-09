import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import type { RequestRecord } from "../../../shared/types/index";
import RequestRow from "./RequestRow.vue";

function makeRequest(over: Partial<RequestRecord> = {}): RequestRecord {
    return {
        id: "r1", instanceId: "i1", url: "/users", method: "GET",
        startedAt: 1_000, duration: 40, status: "success", statusCode: 200,
        requestHeaders: {}, payload: null, queryParams: null, response: null,
        error: null, truncated: false, instanceOptions: undefined,
        ...over,
    };
}

describe("RequestRow — 401 → refreshed badge", () => {
    it("hides the badge when authRetried is absent", () => {
        const w = mount(RequestRow, { props: { request: makeRequest(), isActive: false } });
        expect(w.find('[data-test="auth-retried"]').exists()).toBe(false);
    });

    it("shows the warning badge when authRetried is set", () => {
        const w = mount(RequestRow, { props: { request: makeRequest({ authRetried: true }), isActive: false } });
        const badge = w.find('[data-test="auth-retried"]');
        expect(badge.exists()).toBe(true);
        expect(badge.text()).toBe("401 → refreshed");
        expect(badge.classes()).toContain("badge--warning");
    });
});
