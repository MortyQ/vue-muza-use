import { describe, it, expect } from "vitest";
import { formatDuration, formatRemaining } from "./formatDuration";

describe("formatDuration (config values)", () => {
    it("formats sub-second as ms", () => expect(formatDuration(500)).toBe("500ms"));
    it("formats seconds", () => expect(formatDuration(30_000)).toBe("30s"));
    it("formats minutes", () => expect(formatDuration(300_000)).toBe("5m"));
    it("formats fractional hours", () => expect(formatDuration(5_400_000)).toBe("1.5h"));
    it("formats days", () => expect(formatDuration(86_400_000)).toBe("1d"));
    it("formats Infinity", () => expect(formatDuration(Infinity)).toBe("∞"));
    it("formats zero", () => expect(formatDuration(0)).toBe("0ms"));
});

describe("formatRemaining (countdown values)", () => {
    it("seconds only", () => expect(formatRemaining(7_000)).toBe("7s"));
    it("minutes and seconds", () => expect(formatRemaining(292_000)).toBe("4m 52s"));
    it("hours and minutes", () => expect(formatRemaining(3_720_000)).toBe("1h 2m"));
    it("days and hours", () => expect(formatRemaining(90_000_000)).toBe("1d 1h"));
    it("clamps negatives to 0s", () => expect(formatRemaining(-5)).toBe("0s"));
    it("Infinity", () => expect(formatRemaining(Infinity)).toBe("∞"));
});
