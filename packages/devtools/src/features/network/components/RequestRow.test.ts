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

describe("RequestRow — url and badge layout", () => {
    const options = {
        authMode: "default" as const,
        cache: { staleTime: 300_000, swr: true, freshFor: 0 },
        retry: false, poll: 0, immediate: true, lazy: false,
    };

    it("exposes the full url in a title tooltip", () => {
        const url = "/insightful/analytics/reports/8f3a4c/summary";
        const w = mount(RequestRow, { props: { request: makeRequest({ url }), isActive: false } });
        const el = w.find(".row-url");
        expect(el.attributes("title")).toBe(url);
        expect(el.text()).toBe(url);
    });

    it("renders feature badges in the meta row, not next to the url", () => {
        const w = mount(RequestRow, {
            props: { request: makeRequest(), isActive: false, instanceOptions: options },
        });
        expect(w.find(".row-meta .feature-badges").exists()).toBe(true);
        expect(w.find(".row-top .feature-badges").exists()).toBe(false);
    });

    it("omits the badge wrapper when instanceOptions is absent", () => {
        const w = mount(RequestRow, { props: { request: makeRequest(), isActive: false } });
        expect(w.find(".row-badges").exists()).toBe(false);
    });
});

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
