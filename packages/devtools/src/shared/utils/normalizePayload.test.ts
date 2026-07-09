import { describe, it, expect } from "vitest";
import { normalizePayload, formatBytes } from "./normalizePayload";

describe("formatBytes", () => {
    it("formats byte counts under 1000 as B", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(847)).toBe("847 B");
    });

    it("formats kilobytes with one decimal", () => {
        expect(formatBytes(12_300)).toBe("12.3 kB");
    });

    it("formats megabytes with one decimal", () => {
        expect(formatBytes(1_200_000)).toBe("1.2 MB");
    });
});

describe("normalizePayload — FormData", () => {
    it("maps string fields to a plain object", () => {
        const form = new FormData();
        form.append("name", "Alice");
        form.append("role", "admin");
        expect(normalizePayload(form)).toEqual({ name: "Alice", role: "admin" });
    });

    it("describes File entries with name, type, and size", () => {
        const form = new FormData();
        form.append("avatar", new File(["x".repeat(1234)], "a.png", { type: "image/png" }));
        expect(normalizePayload(form)).toEqual({ avatar: 'file "a.png" (image/png, 1.2 kB)' });
    });

    it("mixes string and file fields", () => {
        const form = new FormData();
        form.append("title", "hello");
        form.append("doc", new File(["abc"], "doc.pdf", { type: "application/pdf" }));
        expect(normalizePayload(form)).toEqual({
            title: "hello",
            doc: 'file "doc.pdf" (application/pdf, 3 B)',
        });
    });

    it("collects duplicate keys into an array", () => {
        const form = new FormData();
        form.append("tag", "a");
        form.append("tag", "b");
        form.append("tag", "c");
        expect(normalizePayload(form)).toEqual({ tag: ["a", "b", "c"] });
    });

    it("falls back to 'unknown' for files without a MIME type", () => {
        const form = new FormData();
        form.append("data", new File(["x"], "raw.bin"));
        expect(normalizePayload(form)).toEqual({ data: 'file "raw.bin" (unknown, 1 B)' });
    });
});

describe("normalizePayload — top-level binaries", () => {
    it("describes a top-level File", () => {
        const file = new File(["x".repeat(500)], "photo.jpg", { type: "image/jpeg" });
        expect(normalizePayload(file)).toBe('file "photo.jpg" (image/jpeg, 500 B)');
    });

    it("describes a top-level Blob", () => {
        const blob = new Blob(["x".repeat(2048)], { type: "application/pdf" });
        expect(normalizePayload(blob)).toBe("blob (application/pdf, 2.0 kB)");
    });

    it("converts URLSearchParams to a plain object", () => {
        const params = new URLSearchParams("a=1&b=2&a=3");
        expect(normalizePayload(params)).toEqual({ a: ["1", "3"], b: "2" });
    });
});

describe("normalizePayload — passthrough", () => {
    it("returns plain objects unchanged", () => {
        const obj = { name: "Alice", nested: { x: 1 } };
        expect(normalizePayload(obj)).toBe(obj);
    });

    it("returns strings, numbers, and null unchanged", () => {
        expect(normalizePayload("raw body")).toBe("raw body");
        expect(normalizePayload(42)).toBe(42);
        expect(normalizePayload(null)).toBe(null);
        expect(normalizePayload(undefined)).toBe(undefined);
    });

    it("returns arrays unchanged", () => {
        const arr = [1, 2, 3];
        expect(normalizePayload(arr)).toBe(arr);
    });
});
