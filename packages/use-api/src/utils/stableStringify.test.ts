import { describe, it, expect } from "vitest";

import { stableStringify } from "./stableStringify";

describe("stableStringify", () => {
    describe("primitives", () => {
        it("serializes numbers, strings, booleans like JSON", () => {
            expect(stableStringify(42)).toBe("42");
            expect(stableStringify("hi")).toBe('"hi"');
            expect(stableStringify(true)).toBe("true");
        });

        it("top-level null and undefined become an empty string", () => {
            expect(stableStringify(null)).toBe("");
            expect(stableStringify(undefined)).toBe("");
        });

        it("empty object and empty array are distinct", () => {
            expect(stableStringify({})).toBe("{}");
            expect(stableStringify([])).toBe("[]");
        });
    });

    describe("key-order independence", () => {
        it("sorts object keys lexicographically", () => {
            expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
            expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
        });

        it("sorts nested object keys recursively", () => {
            const x = { outer: { z: 1, a: 2 }, first: true };
            const y = { first: true, outer: { a: 2, z: 1 } };
            expect(stableStringify(x)).toBe(stableStringify(y));
        });
    });

    describe("arrays", () => {
        it("preserves array order (order is meaningful)", () => {
            expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
            expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
        });

        it("sorts keys inside array elements but keeps element order", () => {
            const a = stableStringify([{ b: 1, a: 2 }, { d: 3, c: 4 }]);
            expect(a).toBe('[{"a":2,"b":1},{"c":4,"d":3}]');
        });
    });

    describe("null vs undefined", () => {
        it("omits keys whose value is undefined", () => {
            expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
            expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
        });

        it("keeps keys whose value is null", () => {
            expect(stableStringify({ a: 1, b: null })).toBe('{"a":1,"b":null}');
        });
    });

    describe("real-world filter payload", () => {
        it("produces identical output regardless of key insertion order", () => {
            const payloadA = {
                brand: ["ART", "APK", "SKN", "BOY"],
                channel: [10, 1],
                product: [],
                granularity: "MONTH",
                period: { since: "2026-04-08", until: "2026-07-08" },
                isGroupByDate: true,
                limit: 10,
                page: 1,
                sort: [
                    { field: "DATE", order: "desc" },
                    { field: "SALES", order: "desc" },
                ],
            };
            const payloadB = {
                sort: [
                    { order: "desc", field: "DATE" },
                    { order: "desc", field: "SALES" },
                ],
                page: 1,
                limit: 10,
                isGroupByDate: true,
                period: { until: "2026-07-08", since: "2026-04-08" },
                granularity: "MONTH",
                product: [],
                channel: [10, 1],
                brand: ["ART", "APK", "SKN", "BOY"],
            };
            expect(stableStringify(payloadA)).toBe(stableStringify(payloadB));
        });

        it("different array order in a meaningful field yields different keys", () => {
            const a = { channel: [10, 1] };
            const b = { channel: [1, 10] };
            expect(stableStringify(a)).not.toBe(stableStringify(b));
        });
    });
});
