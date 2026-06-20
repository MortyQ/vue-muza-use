import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("idb-keyval", () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../style.css", () => ({}));

// Stub FloatingPanel so we don't need real SFC in this unit test
vi.mock("../features/panel/components/FloatingPanel.vue", () => ({
    default: { template: "<div/>" },
}));

import { mountDevtoolsPanel } from "./devtoolsPlugin";

function cleanup() {
    document.getElementById("vue-muza-devtools-root")?.remove();
    window.__vmdPendingCss = undefined;
}

beforeEach(cleanup);

describe("mountDevtoolsPanel — dev mode (no pending CSS)", () => {
    it("appends a container div to document.body", () => {
        mountDevtoolsPanel();
        expect(document.getElementById("vue-muza-devtools-root")).not.toBeNull();
    });

    it("does not mount twice if called again", () => {
        mountDevtoolsPanel();
        mountDevtoolsPanel();
        expect(document.querySelectorAll("#vue-muza-devtools-root").length).toBe(1);
    });

    it("does not create a shadow root in dev mode", () => {
        mountDevtoolsPanel();
        const host = document.getElementById("vue-muza-devtools-root")!;
        expect(host.shadowRoot).toBeNull();
    });
});

describe("mountDevtoolsPanel — production mode (pending CSS present)", () => {
    beforeEach(() => {
        window.__vmdPendingCss = "body{}";
    });

    it("mounts inside a shadow root", () => {
        mountDevtoolsPanel();
        const host = document.getElementById("vue-muza-devtools-root")!;
        expect(host.shadowRoot).not.toBeNull();
    });

    it("injects a style element into the shadow root", () => {
        mountDevtoolsPanel();
        const host = document.getElementById("vue-muza-devtools-root")!;
        expect(host.shadowRoot!.querySelector("style")).not.toBeNull();
    });

    it("clears __vmdPendingCss after mounting", () => {
        mountDevtoolsPanel();
        expect(window.__vmdPendingCss).toBeUndefined();
    });
});
