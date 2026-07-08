import { describe, it, expect } from "vitest";

import { parseDuration } from "./time";

describe("parseDuration", () => {
    describe("numbers pass through", () => {
        it("returns a plain number unchanged", () => {
            expect(parseDuration(1500)).toBe(1500);
        });

        it("returns 0 unchanged", () => {
            expect(parseDuration(0)).toBe(0);
        });

        it("returns Infinity unchanged", () => {
            expect(parseDuration(Infinity)).toBe(Infinity);
        });
    });

    describe("duration strings", () => {
        it("parses milliseconds", () => {
            expect(parseDuration("500ms")).toBe(500);
        });

        it("parses seconds", () => {
            expect(parseDuration("30s")).toBe(30_000);
        });

        it("parses minutes", () => {
            expect(parseDuration("5m")).toBe(300_000);
        });

        it("parses hours", () => {
            expect(parseDuration("1h")).toBe(3_600_000);
        });

        it("parses days", () => {
            expect(parseDuration("1d")).toBe(86_400_000);
        });

        it("parses decimal values", () => {
            expect(parseDuration("1.5h")).toBe(5_400_000);
        });
    });

    describe("malformed strings", () => {
        it.each(["5x", "h1", "5 m", "", "abc", "-5m"])(
            "throws TypeError for %j",
            (input) => {
                // Malformed strings are unreachable through the DurationString type —
                // the cast simulates consumer code bypassing it with `as`
                expect(() => parseDuration(input as never)).toThrow(TypeError);
            },
        );
    });
});
