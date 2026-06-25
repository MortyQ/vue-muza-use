import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick, ref } from "vue";
import type { PanelGeometry } from "../../../shared/types/index";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelGeometry: vi.fn().mockResolvedValue(undefined),
    savePanelGeometry: vi.fn().mockResolvedValue(undefined),
}));

import { loadPanelGeometry, savePanelGeometry } from "../../../shared/storage/devtoolsStorage";
import { usePanelGeometry, _resetGeometryForTesting, _setGeometryForTesting } from "./usePanelGeometry";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => {
    vi.clearAllMocks();
    _resetGeometryForTesting();
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(cb => { cb(0); return 0; });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    vi.mocked(loadPanelGeometry).mockResolvedValue(undefined);
    vi.mocked(savePanelGeometry).mockResolvedValue(undefined);
});

describe("initialization", () => {
    it("isGeometryReady starts false, becomes true after mount resolves", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        expect(result.isGeometryReady.value).toBe(false);
        await nextTick();
        await nextTick();
        expect(result.isGeometryReady.value).toBe(true);
        unmount();
    });

    it("loads saved side geometry from storage on mount", async () => {
        const saved: PanelGeometry = { x: 500, y: 20, width: 400, height: 700 };
        vi.mocked(loadPanelGeometry).mockImplementation(async (mode) =>
            mode === "side" ? saved : undefined
        );
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick();
        await nextTick();
        expect(result.geometry.value).toEqual(saved);
        unmount();
    });

    it("loads saved bottom geometry from storage on mount", async () => {
        const saved: PanelGeometry = { x: 50, y: 400, width: 1000, height: 300 };
        vi.mocked(loadPanelGeometry).mockImplementation(async (mode) =>
            mode === "bottom" ? saved : undefined
        );
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick();
        await nextTick();
        expect(result.geometry.value).toEqual(saved);
        unmount();
    });

    it("uses computed default side geometry when no storage value", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick();
        await nextTick();
        // side default: x = innerWidth - 390, y = 10, width = 380, height = innerHeight - 20
        expect(result.geometry.value).toEqual({ x: 890, y: 10, width: 380, height: 780 });
        unmount();
    });

    it("uses computed default bottom geometry when no storage value", async () => {
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick();
        await nextTick();
        // bottom default: x = 12, y = innerHeight - 368, width = innerWidth - 24, height = 360
        expect(result.geometry.value).toEqual({ x: 12, y: 432, width: 1256, height: 360 });
        unmount();
    });
});

describe("mode switching", () => {
    it("geometry switches when panelMode changes", async () => {
        const savedSide: PanelGeometry = { x: 800, y: 10, width: 380, height: 780 };
        const savedBottom: PanelGeometry = { x: 12, y: 400, width: 1000, height: 360 };
        vi.mocked(loadPanelGeometry).mockImplementation(async (m) =>
            m === "side" ? savedSide : savedBottom
        );
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick();
        await nextTick();
        expect(result.geometry.value).toEqual(savedSide);
        mode.value = "bottom";
        await nextTick();
        expect(result.geometry.value).toEqual(savedBottom);
        unmount();
    });
});

describe("drag", () => {
    it("dragging moves panel position and saves on mouseup", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 50, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 150 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 250, clientY: 200 }));
        await nextTick();

        expect(result.geometry.value.x).toBe(150);
        expect(result.geometry.value.y).toBe(100);

        window.dispatchEvent(new MouseEvent("mouseup"));
        expect(savePanelGeometry).toHaveBeenCalledWith("side", expect.objectContaining({ x: 150, y: 100 }));
        unmount();
    });

    it("drag clamps x to 0 at left viewport edge", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 10, y: 50, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 150 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 0, clientY: 150 }));
        await nextTick();

        expect(result.geometry.value.x).toBe(0);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("drag clamps y so panel stays fully in viewport", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 10, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 100 } as MouseEvent);
        // Drag far down — y clamped to innerHeight - panel.height (800 - 600 = 200)
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 200, clientY: 9999 }));
        await nextTick();

        expect(result.geometry.value.y).toBe(200);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("further mousemove after mouseup has no effect", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 50, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 150 } as MouseEvent);
        window.dispatchEvent(new MouseEvent("mouseup"));
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 400, clientY: 400 }));
        await nextTick();

        expect(result.geometry.value.x).toBe(100);
        unmount();
    });
});

describe("startResizeTop", () => {
    it("dragging up increases height and decreases y", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 100, width: 380, height: 400 });

        result.startResizeTop({ clientY: 100 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 60 }));
        await nextTick();

        // dy = 60 - 100 = -40 → height = 400 - (-40) = 440, y = 100 + 400 - 440 = 60
        expect(result.geometry.value.height).toBe(440);
        expect(result.geometry.value.y).toBe(60);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("height cannot go below MIN_HEIGHT_SIDE (200)", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 100, width: 380, height: 220 });

        result.startResizeTop({ clientY: 100 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 500 }));
        await nextTick();

        expect(result.geometry.value.height).toBe(200);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("y cannot go below 0", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 5, width: 380, height: 400 });

        result.startResizeTop({ clientY: 5 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: -9999 }));
        await nextTick();

        // y clamped: newH = min(bottomEdge=405, ...) → 405, newY = 405 - 405 = 0
        expect(result.geometry.value.y).toBe(0);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("saves geometry on mouseup", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 100, width: 380, height: 400 });

        result.startResizeTop({ clientY: 100 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 60 }));
        window.dispatchEvent(new MouseEvent("mouseup"));

        expect(savePanelGeometry).toHaveBeenCalledWith("side", expect.objectContaining({ height: 440, y: 60 }));
        unmount();
    });
});

describe("startResizeBottom", () => {
    it("dragging down increases height", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 100, width: 380, height: 400 });

        result.startResizeBottom({ clientY: 500 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 550 }));
        await nextTick();

        // dy = 50 → height = 400 + 50 = 450
        expect(result.geometry.value.height).toBe(450);
        expect(result.geometry.value.y).toBe(100);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("height cannot go below MIN_HEIGHT_SIDE (200)", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 100, width: 380, height: 220 });

        result.startResizeBottom({ clientY: 320 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 0 }));
        await nextTick();

        expect(result.geometry.value.height).toBe(200);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("height capped by viewport bottom", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 50, width: 380, height: 400 });

        result.startResizeBottom({ clientY: 450 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 9999 }));
        await nextTick();

        // maxH = innerHeight - y = 800 - 50 = 750
        expect(result.geometry.value.height).toBe(750);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });
});

describe("startResizeLeft", () => {
    it("dragging left increases width and decreases x", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 500, y: 10, width: 380, height: 600 });

        result.startResizeLeft({ clientX: 500 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 450 }));
        await nextTick();

        // dx = -50 → width = 380 - (-50) = 430, x = 500 + 380 - 430 = 450
        expect(result.geometry.value.width).toBe(430);
        expect(result.geometry.value.x).toBe(450);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("width cannot go below MIN_WIDTH_SIDE (280)", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 500, y: 10, width: 300, height: 600 });

        result.startResizeLeft({ clientX: 500 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 9999 }));
        await nextTick();

        expect(result.geometry.value.width).toBe(280);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("x cannot go below 0", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 10, y: 10, width: 380, height: 600 });

        result.startResizeLeft({ clientX: 10 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: -9999 }));
        await nextTick();

        // rightEdge = 390, maxW = rightEdge = 390, so x = 390 - 390 = 0
        expect(result.geometry.value.x).toBe(0);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });
});

describe("startResizeRight", () => {
    it("dragging right increases width", async () => {
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("bottom", { x: 12, y: 400, width: 800, height: 360 });

        result.startResizeRight({ clientX: 812 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 862 }));
        await nextTick();

        // dx = 50 → width = 800 + 50 = 850
        expect(result.geometry.value.width).toBe(850);
        expect(result.geometry.value.x).toBe(12);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("width cannot go below MIN_WIDTH_BOTTOM (400)", async () => {
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("bottom", { x: 12, y: 400, width: 420, height: 360 });

        result.startResizeRight({ clientX: 432 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 0 }));
        await nextTick();

        expect(result.geometry.value.width).toBe(400);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("width capped by viewport right edge", async () => {
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("bottom", { x: 12, y: 400, width: 800, height: 360 });

        result.startResizeRight({ clientX: 812 } as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 9999 }));
        await nextTick();

        // maxW = innerWidth - x = 1280 - 12 = 1268
        expect(result.geometry.value.width).toBe(1268);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });
});

describe("resetGeometry", () => {
    it("resets side geometry to computed default and saves", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 0, y: 0, width: 600, height: 200 });

        result.resetGeometry();

        expect(result.geometry.value).toEqual({ x: 890, y: 10, width: 380, height: 780 });
        expect(savePanelGeometry).toHaveBeenCalledWith("side", { x: 890, y: 10, width: 380, height: 780 });
        unmount();
    });

    it("resets bottom geometry to computed default and saves", async () => {
        const mode = ref<"side" | "bottom">("bottom");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("bottom", { x: 0, y: 0, width: 200, height: 100 });

        result.resetGeometry();

        expect(result.geometry.value).toEqual({ x: 12, y: 432, width: 1256, height: 360 });
        expect(savePanelGeometry).toHaveBeenCalledWith("bottom", { x: 12, y: 432, width: 1256, height: 360 });
        unmount();
    });
});

describe("cleanup", () => {
    it("removes listeners on scope dispose if drag is in progress", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 50, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 150 } as MouseEvent);
        unmount(); // triggers onScopeDispose

        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 999, clientY: 999 }));
        await nextTick();

        expect(result.geometry.value.x).toBe(100); // unchanged after unmount
    });
});
