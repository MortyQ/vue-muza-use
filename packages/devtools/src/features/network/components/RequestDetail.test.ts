import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import type { RequestRecord } from "../../../shared/types/index";
import RequestDetail from "./RequestDetail.vue";

const stubs = {
    DetailHeader: { template: "<div />" },
    DetailTabs: { template: "<div />" },
    SplitView: { template: "<div />" },
    DataPane: { template: "<div />" },
    PayloadPane: { template: "<div />" },
};

const mockRequest: RequestRecord = {
    id: "r-1",
    instanceId: null,
    url: "/api/users",
    method: "GET",
    startedAt: Date.now(),
    duration: 42,
    status: "success",
    statusCode: 200,
    requestHeaders: { "content-type": "application/json" },
    payload: null,
    queryParams: null,
    response: { users: [] },
    error: null,
    truncated: false,
    instanceOptions: undefined,
};

describe("RequestDetail", () => {
    it("mounts without crashing when a request is provided", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        expect(wrapper.exists()).toBe(true);
    });

    it("renders the .request-detail container", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        expect(wrapper.find(".request-detail").exists()).toBe(true);
    });

    it("mounts without crashing when instanceOptions is provided", () => {
        const wrapper = mount(RequestDetail, {
            props: {
                request: mockRequest,
                instanceOptions: {
                    authMode: "default",
                    cache: undefined,
                    retry: false,
                    poll: 0,
                    immediate: true,
                    lazy: false,
                },
            },
            global: { stubs },
        });
        expect(wrapper.exists()).toBe(true);
    });
});

describe("RequestDetail — headers tab", () => {
    it("renders Request Headers and Response Headers sections", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        expect(wrapper.text()).toContain("Request Headers");
        expect(wrapper.text()).toContain("Response Headers");
    });

    it("renders request header rows when present", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        const section = wrapper.find('[data-test="request-headers"]');
        expect(section.text()).toContain("content-type");
        expect(section.text()).toContain("application/json");
        expect(section.text()).not.toContain("No request headers captured.");
    });

    it("renders response header rows when present", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: { ...mockRequest, responseHeaders: { "x-request-id": "abc" } } },
            global: { stubs },
        });
        const section = wrapper.find('[data-test="response-headers"]');
        expect(section.text()).toContain("x-request-id");
        expect(section.text()).toContain("abc");
    });

    it("shows per-section empty states when headers are absent", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: { ...mockRequest, requestHeaders: {} } },
            global: { stubs },
        });
        expect(wrapper.find('[data-test="request-headers"]').text()).toContain("No request headers captured.");
        expect(wrapper.find('[data-test="response-headers"]').text()).toContain("No response headers captured.");
    });
});
