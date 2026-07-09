import { describe, it, expect } from "vitest";
import { AxiosHeaders } from "axios";
import { normalizeHeaders } from "./headerUtils";

describe("normalizeHeaders", () => {
    describe("input shapes", () => {
        it("returns undefined for undefined input", () => {
            expect(normalizeHeaders(undefined)).toBeUndefined();
        });

        it("returns undefined for null input", () => {
            expect(normalizeHeaders(null)).toBeUndefined();
        });

        it("returns undefined for non-object input", () => {
            expect(normalizeHeaders("Content-Type: text/html")).toBeUndefined();
        });

        it("returns undefined for an empty object", () => {
            expect(normalizeHeaders({})).toBeUndefined();
        });

        it("normalizes a plain object", () => {
            expect(normalizeHeaders({ "Content-Type": "application/json" })).toEqual({
                "Content-Type": "application/json",
            });
        });

        it("unwraps an AxiosHeaders instance via toJSON", () => {
            const headers = new AxiosHeaders();
            headers.set("Content-Type", "application/json");
            headers.set("X-Request-Id", "abc-123");
            expect(normalizeHeaders(headers)).toEqual({
                "Content-Type": "application/json",
                "X-Request-Id": "abc-123",
            });
        });

        it("skips null and undefined entries", () => {
            expect(normalizeHeaders({ a: "1", b: null, c: undefined })).toEqual({ a: "1" });
        });

        it("coerces non-string values to strings", () => {
            expect(normalizeHeaders({ "Content-Length": 42, "X-Flag": true })).toEqual({
                "Content-Length": "42",
                "X-Flag": "true",
            });
        });

        it("joins array values (e.g. set-cookie) with a comma", () => {
            expect(normalizeHeaders({ "x-custom": ["a=1", "b=2"] })).toEqual({
                "x-custom": "a=1, b=2",
            });
        });
    });

    describe("sensitive value masking", () => {
        it("masks Authorization keeping a recognizable prefix", () => {
            const result = normalizeHeaders({
                Authorization: "Bearer eyJabc.def.ghi-a-very-long-jwt-token",
            });
            expect(result?.Authorization).toBe("Bearer eyJab…[redacted]");
        });

        it("masks header keys case-insensitively", () => {
            const result = normalizeHeaders({ AUTHORIZATION: "Bearer eyJabc.def.ghi.jkl" });
            expect(result?.AUTHORIZATION).toContain("[redacted]");
        });

        it("masks cookie and set-cookie headers", () => {
            const result = normalizeHeaders({
                cookie: "sid=super-secret-session-value",
                "set-cookie": ["sid=next-secret-value; HttpOnly"],
            });
            expect(result?.cookie).toContain("[redacted]");
            expect(result?.["set-cookie"]).toContain("[redacted]");
        });

        it("masks api-key style headers", () => {
            const result = normalizeHeaders({ "X-Api-Key": "sk-live-0123456789abcdef" });
            expect(result?.["X-Api-Key"]).toBe("sk-live-0123…[redacted]");
        });

        it("fully replaces short sensitive values (no prefix leak)", () => {
            const result = normalizeHeaders({ Authorization: "abc123" });
            expect(result?.Authorization).toBe("•••redacted•••");
            expect(result?.Authorization).not.toContain("abc123");
        });

        it("leaves non-sensitive values untouched", () => {
            const result = normalizeHeaders({
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0 something long enough to not be short",
            });
            expect(result?.Accept).toBe("application/json");
            expect(result?.["User-Agent"]).not.toContain("redacted");
        });
    });
});
