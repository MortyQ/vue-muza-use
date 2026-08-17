/**
 * Request bodies that are not plain JSON: FormData, URLSearchParams, Blob.
 *
 * These tests run against a REAL axios instance from createApiClient with a stub
 * adapter, not a mocked `axios.request`. That distinction is the whole point: the
 * body is rewritten by axios's own `transformRequest`, which a `vi.spyOn(axios,
 * "request")` mock never reaches — which is why file uploads went uncovered for
 * so long despite the suite touching headers in 20+ files.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";

import { useApi } from "./useApi";
import { createApi } from "./plugin";
import { createApiClient } from "./features/createInstance";
import { clearAllCache } from "./features/cacheManager";
import type { UseApiOptions } from "./types";

/** What the adapter saw — i.e. what would have gone on the wire. */
interface Wire {
    body: unknown;
    contentType: unknown;
    headers: Record<string, unknown>;
}

let client: AxiosInstance;
let wire: Wire;

beforeEach(() => {
    clearAllCache();
    wire = { body: null, contentType: null, headers: {} };
    client = createApiClient({ baseURL: "http://api.test" });
    client.defaults.adapter = async (config) => {
        const headers = (config.headers ?? {}) as Record<string, unknown>;
        wire = { body: config.data, contentType: headers["Content-Type"], headers };
        return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config } as never;
    };
});

function mountApi(url: string, options: UseApiOptions = {}) {
    let api!: ReturnType<typeof useApi>;
    mount(
        defineComponent({
            setup() {
                api = useApi(url, options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: client })] } },
    );
    return api;
}

function formData(): FormData {
    const fd = new FormData();
    fd.append("name", "report");
    fd.append("file", new Blob(["file-bytes"]), "report.csv");
    return fd;
}

describe("useApi — JSON bodies are untouched", () => {
    it("a plain object is serialized as JSON with the application/json default", async () => {
        const api = mountApi("/items", { method: "POST", data: { a: 1 }, lazy: true });
        await api.execute();

        expect(wire.body).toBe('{"a":1}');
        expect(wire.contentType).toBe("application/json");
    });

    it("a GET without a body is unaffected", async () => {
        const api = mountApi("/items", { lazy: true });
        await api.execute();

        expect(wire.body).toBeUndefined();
        expect(wire.contentType).toBe("application/json");
    });
});

describe("useApi — FormData", () => {
    it("reaches the adapter intact and is multipart when no Content-Type was given", async () => {
        const api = mountApi("/upload", { method: "POST", data: formData(), lazy: true });
        await api.execute();

        expect(wire.body).toBeInstanceOf(FormData);
        expect((wire.body as FormData).get("name")).toBe("report");
        expect(wire.contentType).toBe("multipart/form-data");
    });

    it("passed per-call via execute({ data }) is handled the same way", async () => {
        const api = mountApi("/upload", { method: "POST", lazy: true });
        await api.execute({ data: formData() });

        expect(wire.body).toBeInstanceOf(FormData);
        expect(wire.contentType).toBe("multipart/form-data");
    });

    it("an explicit multipart Content-Type is respected", async () => {
        const api = mountApi("/upload", {
            method: "POST",
            data: formData(),
            headers: { "Content-Type": "multipart/form-data" },
            lazy: true,
        });
        await api.execute();

        expect(wire.body).toBeInstanceOf(FormData);
        expect(wire.contentType).toBe("multipart/form-data");
    });

    it("an explicit application/json still converts the form to JSON — axios's formDataToJSON is a deliberate feature", async () => {
        const api = mountApi("/upload", {
            method: "POST",
            data: formData(),
            headers: { "Content-Type": "application/json" },
            lazy: true,
        });
        await api.execute();

        expect(typeof wire.body).toBe("string");
        expect(wire.contentType).toBe("application/json");
    });

    it("unrelated headers survive alongside the body-derived Content-Type", async () => {
        const api = mountApi("/upload", {
            method: "POST",
            data: formData(),
            headers: { "X-Trace": "abc" },
            lazy: true,
        });
        await api.execute();

        expect(wire.body).toBeInstanceOf(FormData);
        expect(wire.headers["X-Trace"]).toBe("abc");
        expect(wire.contentType).toBe("multipart/form-data");
    });
});

describe("useApi — URLSearchParams", () => {
    it("is sent url-encoded, not labelled application/json", async () => {
        const api = mountApi("/form", {
            method: "POST",
            data: new URLSearchParams({ a: "1" }),
            lazy: true,
        });
        await api.execute();

        expect(wire.body).toBe("a=1");
        expect(String(wire.contentType)).toContain("application/x-www-form-urlencoded");
    });
});

describe("useApi — Blob bodies (axios-level caveat, not something the library can fix)", () => {
    it("a raw Blob body is JSON-ified by axios unless a Content-Type is set explicitly", async () => {
        const api = mountApi("/raw", {
            method: "POST",
            data: new Blob(["xyz"], { type: "text/plain" }),
            lazy: true,
        });
        await api.execute();

        // axios's transformRequest treats a Blob as a plain object payload; the
        // remedy is an explicit Content-Type, or wrapping the blob in FormData.
        expect(typeof wire.body).toBe("string");
    });
});
