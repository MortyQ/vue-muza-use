import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import CopyButton from "./CopyButton.vue";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe("CopyButton", () => {
    it("copies the value prop to the clipboard on click", async () => {
        const w = mount(CopyButton, { props: { value: "cache-key-123" } });
        await w.find("button").trigger("click");
        expect(writeText).toHaveBeenCalledWith("cache-key-123");
    });

    it("renders an icon, not the 'copy' text", () => {
        const w = mount(CopyButton, { props: { value: "x" } });
        expect(w.text()).not.toContain("copy");
        expect(w.find(".iconify, svg").exists()).toBe(true);
    });

    it("flips the aria-label to 'Copied' after a click", async () => {
        const w = mount(CopyButton, { props: { value: "x" } });
        expect(w.find("button").attributes("aria-label")).toBe("Copy");
        await w.find("button").trigger("click");
        expect(w.find("button").attributes("aria-label")).toBe("Copied");
    });

    it("resets the copied state after 1.5s", async () => {
        const w = mount(CopyButton, { props: { value: "x" } });
        await w.find("button").trigger("click");
        expect(w.find("button").classes()).toContain("copied");

        await vi.advanceTimersByTimeAsync(1_500);
        expect(w.find("button").classes()).not.toContain("copied");
        expect(w.find("button").attributes("aria-label")).toBe("Copy");
    });
});
