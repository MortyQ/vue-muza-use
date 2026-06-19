import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelMode: vi.fn().mockResolvedValue("side"),
    savePanelMode: vi.fn().mockResolvedValue(undefined),
    loadPanelGeometry: vi.fn().mockResolvedValue(undefined),
    savePanelGeometry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./usePanelGeometry", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./usePanelGeometry")>();
    return actual; // use real implementation — geometry is already tested in usePanelGeometry.test.ts
});

import { loadPanelMode, savePanelMode } from "../../../shared/storage/devtoolsStorage";
import { _resetGeometryForTesting } from "./usePanelGeometry";
import { useFloatingPanel, _resetPanelModeForTesting } from "./useFloatingPanel";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => {
    vi.clearAllMocks();
    _resetPanelModeForTesting();
    _resetGeometryForTesting();
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(cb => { cb(0); return 0; });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});

describe("initial state", () => {
    it("starts with mode 'side', closed, and geometry not ready", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(result.panelMode.value).toBe("side");
        expect(result.isOpen.value).toBe(false);
        expect(result.isGeometryReady.value).toBe(false);
        unmount();
    });

    it("exposes all geometry handlers", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(typeof result.startDrag).toBe("function");
        expect(typeof result.startResizeTop).toBe("function");
        expect(typeof result.startResizeBottom).toBe("function");
        expect(typeof result.startResizeLeft).toBe("function");
        expect(typeof result.startResizeRight).toBe("function");
        expect(typeof result.resetGeometry).toBe("function");
        unmount();
    });
});

describe("storage hydration", () => {
    it("loads saved panel mode on mount", async () => {
        vi.mocked(loadPanelMode).mockResolvedValue("bottom");
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.panelMode.value).toBe("bottom");
        unmount();
    });
});

describe("toggle / close", () => {
    it("toggle flips isOpen", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.toggle();
        expect(result.isOpen.value).toBe(true);
        result.toggle();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });

    it("close sets isOpen to false", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.toggle();
        result.close();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("panel mode", () => {
    it("switchMode updates panelMode and saves to storage", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.switchMode("bottom");
        expect(result.panelMode.value).toBe("bottom");
        expect(savePanelMode).toHaveBeenCalledWith("bottom");
        unmount();
    });

    it("panelMode is shared across multiple composable calls", () => {
        const { result: r1, unmount: u1 } = withSetup(() => useFloatingPanel());
        const { result: r2, unmount: u2 } = withSetup(() => useFloatingPanel());
        r1.switchMode("bottom");
        expect(r2.panelMode.value).toBe("bottom");
        u1(); u2();
    });
});
