import { describe, it, expect } from "vitest";
import { parseUrlQueryParams } from "./urlUtils";

describe("parseUrlQueryParams", () => {
    it("returns null for undefined", () => {
        expect(parseUrlQueryParams(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseUrlQueryParams("")).toBeNull();
    });

    it("returns null for URL with no query string", () => {
        expect(parseUrlQueryParams("/lists")).toBeNull();
    });

    it("parses a single param", () => {
        expect(parseUrlQueryParams("/lists?q=hello")).toEqual({ q: "hello" });
    });

    it("parses multiple params", () => {
        expect(parseUrlQueryParams("/lists?q=hello&page=2&limit=20")).toEqual({
            q: "hello",
            page: "2",
            limit: "20",
        });
    });

    it("returns null for URL with empty query string (?)", () => {
        expect(parseUrlQueryParams("/lists?")).toBeNull();
    });

    it("handles URL-encoded values", () => {
        expect(parseUrlQueryParams("/search?q=hello%20world")).toEqual({ q: "hello world" });
    });
});
