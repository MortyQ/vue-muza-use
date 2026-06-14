import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub FloatingPanel so we don't need real SFC in this unit test
vi.mock("../features/panel/components/FloatingPanel.vue", () => ({
    default: { template: "<div/>" },
}));

import { mountDevtoolsPanel } from "./devtoolsPlugin";

beforeEach(() => {
    document.getElementById("vue-muza-devtools-root")?.remove();
});

describe("mountDevtoolsPanel", () => {
    it("appends a container div to document.body", () => {
        mountDevtoolsPanel();
        expect(document.getElementById("vue-muza-devtools-root")).not.toBeNull();
    });

    it("does not mount twice if called again", () => {
        mountDevtoolsPanel();
        mountDevtoolsPanel();
        const roots = document.querySelectorAll("#vue-muza-devtools-root");
        expect(roots.length).toBe(1);
    });
});
