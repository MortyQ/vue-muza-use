# Devtools Panel — Drag & Multi-Edge Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-floating drag and multi-edge resize to both devtools panel modes, each storing independent geometry in IndexedDB.

**Architecture:** New `usePanelGeometry.ts` composable owns all geometry (x, y, width, height) for both modes as module-level singletons. `useFloatingPanel.ts` becomes a thin orchestrator that composes `usePanelGeometry`. Components bind style from `geometry` and call the five resize/drag handlers. Logo pill in TabBar becomes the drag handle.

**Tech Stack:** Vue 3 Composition API, `idb-keyval`, Vitest + happy-dom

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/devtools/src/shared/types/index.ts` |
| Modify | `packages/devtools/src/shared/storage/devtoolsStorage.ts` |
| Modify | `packages/devtools/src/shared/storage/devtoolsStorage.test.ts` |
| **Create** | `packages/devtools/src/features/panel/composables/usePanelGeometry.ts` |
| **Create** | `packages/devtools/src/features/panel/composables/usePanelGeometry.test.ts` |
| Modify | `packages/devtools/src/features/panel/composables/useFloatingPanel.ts` |
| Modify | `packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts` |
| Modify | `packages/devtools/src/features/panel/components/SidePanel.vue` |
| Modify | `packages/devtools/src/features/panel/components/FloatingPanel.vue` |
| Modify | `packages/devtools/src/features/panel/components/TabBar.vue` |
| Modify | `packages/devtools/src/features/network/components/NetworkTab.vue` |

---

## Task 1: PanelGeometry type + storage geometry functions

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts`
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.test.ts`

- [ ] **Step 1: Write failing tests for geometry storage functions**

Add to `devtoolsStorage.test.ts` (after the existing imports, add `loadPanelGeometry` and `savePanelGeometry` to the import list, then add at the end of the file):

```ts
// Add to existing imports at top:
import {
    // ...existing imports...,
    loadPanelGeometry,
    savePanelGeometry,
} from "./devtoolsStorage";

// Add at end of file:
describe("panel geometry", () => {
    it("loadPanelGeometry('side') calls get with correct key", async () => {
        const geo = { x: 890, y: 10, width: 380, height: 780 };
        vi.mocked(get).mockResolvedValue(geo);
        const result = await loadPanelGeometry("side");
        expect(get).toHaveBeenCalledWith("vmd:panel-geometry-side");
        expect(result).toEqual(geo);
    });

    it("loadPanelGeometry('bottom') calls get with correct key", async () => {
        const geo = { x: 12, y: 432, width: 1256, height: 360 };
        vi.mocked(get).mockResolvedValue(geo);
        const result = await loadPanelGeometry("bottom");
        expect(get).toHaveBeenCalledWith("vmd:panel-geometry-bottom");
        expect(result).toEqual(geo);
    });

    it("loadPanelGeometry returns undefined if not saved", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadPanelGeometry("side");
        expect(result).toBeUndefined();
    });

    it("savePanelGeometry('side') calls set with correct key", async () => {
        const geo = { x: 890, y: 10, width: 380, height: 780 };
        await savePanelGeometry("side", geo);
        expect(set).toHaveBeenCalledWith("vmd:panel-geometry-side", geo);
    });

    it("savePanelGeometry('bottom') calls set with correct key", async () => {
        const geo = { x: 12, y: 432, width: 1256, height: 360 };
        await savePanelGeometry("bottom", geo);
        expect(set).toHaveBeenCalledWith("vmd:panel-geometry-bottom", geo);
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run -- devtoolsStorage
```

Expected: FAIL — `loadPanelGeometry is not a function`

- [ ] **Step 3: Add `PanelGeometry` interface to `types/index.ts`**

Insert after the `PanelMode` type (after line 11):

```ts
/**
 * Position and size of a devtools panel in a given mode.
 */
export interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
```

- [ ] **Step 4: Add geometry keys and functions to `devtoolsStorage.ts`**

Add to the `KEYS` const object:
```ts
geometrySide: "vmd:panel-geometry-side",
geometryBottom: "vmd:panel-geometry-bottom",
```

Add the import for `PanelGeometry` (update the existing type import at the top):
```ts
import type { PanelMode, PayloadFormat, PanelGeometry } from "../types/index";
```

Add at the end of the file (before the last closing):
```ts
/**
 * Loads the saved panel geometry for the given mode from IndexedDB.
 * Returns undefined if not previously saved.
 */
export async function loadPanelGeometry(mode: PanelMode): Promise<PanelGeometry | undefined> {
    const key = mode === "side" ? KEYS.geometrySide : KEYS.geometryBottom;
    return get<PanelGeometry>(key);
}

/**
 * Saves the panel geometry for the given mode to IndexedDB.
 */
export async function savePanelGeometry(mode: PanelMode, geometry: PanelGeometry): Promise<void> {
    const key = mode === "side" ? KEYS.geometrySide : KEYS.geometryBottom;
    return set(key, geometry);
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run -- devtoolsStorage
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/shared/types/index.ts \
        packages/devtools/src/shared/storage/devtoolsStorage.ts \
        packages/devtools/src/shared/storage/devtoolsStorage.test.ts
git commit -m "feat(devtools): add PanelGeometry type and geometry storage functions"
```

---

## Task 2: Create `usePanelGeometry.ts` (TDD)

**Files:**
- Create: `packages/devtools/src/features/panel/composables/usePanelGeometry.ts`
- Create: `packages/devtools/src/features/panel/composables/usePanelGeometry.test.ts`

- [ ] **Step 1: Write the full test file**

Create `packages/devtools/src/features/panel/composables/usePanelGeometry.test.ts`:

```ts
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

    it("drag clamps y so tabbar stays in viewport", async () => {
        const mode = ref<"side" | "bottom">("side");
        const { result, unmount } = withSetup(() => usePanelGeometry(mode));
        await nextTick(); await nextTick();
        _setGeometryForTesting("side", { x: 100, y: 10, width: 380, height: 600 });

        result.startDrag({ clientX: 200, clientY: 100 } as MouseEvent);
        // Drag far down — y should be clamped to innerHeight - TABBAR_HEIGHT (800 - 38 = 762)
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 200, clientY: 9999 }));
        await nextTick();

        expect(result.geometry.value.y).toBe(762);
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run -- usePanelGeometry
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `usePanelGeometry.ts`**

Create `packages/devtools/src/features/panel/composables/usePanelGeometry.ts`:

```ts
import { ref, computed, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type { PanelMode, PanelGeometry } from "../../../shared/types/index";
import { loadPanelGeometry, savePanelGeometry } from "../../../shared/storage/devtoolsStorage";

const MIN_WIDTH_SIDE = 280;
const MIN_HEIGHT_SIDE = 200;
const MIN_WIDTH_BOTTOM = 400;
const MIN_HEIGHT_BOTTOM = 200;
const TABBAR_HEIGHT = 38;

function defaultSideGeometry(): PanelGeometry {
    return {
        x: window.innerWidth - 390,
        y: 10,
        width: 380,
        height: window.innerHeight - 20,
    };
}

function defaultBottomGeometry(): PanelGeometry {
    return {
        x: 12,
        y: window.innerHeight - 368,
        width: window.innerWidth - 24,
        height: 360,
    };
}

// Static fallbacks used before window dimensions are available
const STATIC_SIDE: PanelGeometry = { x: 0, y: 10, width: 380, height: 600 };
const STATIC_BOTTOM: PanelGeometry = { x: 12, y: 300, width: 800, height: 360 };

// Module-level singletons — persist across component remounts
const _sideGeometry = ref<PanelGeometry>({ ...STATIC_SIDE });
const _bottomGeometry = ref<PanelGeometry>({ ...STATIC_BOTTOM });
const _isGeometryReady = ref(false);
let _geometryLoaded = false;
let _activeCleanup: (() => void) | null = null;

/**
 * Return type for usePanelGeometry.
 */
export interface UsePanelGeometryReturn {
    /** Reactive geometry for the currently active panel mode. Read-only. */
    geometry: Ref<PanelGeometry>;
    /** False until IndexedDB load completes. Panel should be hidden until true. */
    isGeometryReady: Ref<boolean>;
    /** Attach to logo pill mousedown — drags the panel. */
    startDrag: (e: MouseEvent) => void;
    /** Attach to top resize handle mousedown — resizes height upward. */
    startResizeTop: (e: MouseEvent) => void;
    /** Attach to bottom resize handle mousedown — resizes height downward. */
    startResizeBottom: (e: MouseEvent) => void;
    /** Attach to left resize handle mousedown — resizes width leftward. */
    startResizeLeft: (e: MouseEvent) => void;
    /** Attach to right resize handle mousedown — resizes width rightward. */
    startResizeRight: (e: MouseEvent) => void;
    /** Resets the active mode's geometry to default and saves to IndexedDB. */
    resetGeometry: () => void;
}

/**
 * Composable that owns geometry (x, y, width, height) for both panel modes.
 * Loads from IndexedDB on first mount, persists on every drag/resize mouseup.
 *
 * @example
 * ```ts
 * const { geometry, isGeometryReady, startDrag, startResizeLeft } = usePanelGeometry(panelMode);
 * ```
 */
export function usePanelGeometry(panelMode: Ref<PanelMode>): UsePanelGeometryReturn {
    const geometry = computed(() =>
        panelMode.value === "side" ? _sideGeometry.value : _bottomGeometry.value
    ) as Ref<PanelGeometry>;

    onMounted(async () => {
        if (_geometryLoaded) return;
        const [savedSide, savedBottom] = await Promise.all([
            loadPanelGeometry("side"),
            loadPanelGeometry("bottom"),
        ]);
        _sideGeometry.value = savedSide ?? defaultSideGeometry();
        _bottomGeometry.value = savedBottom ?? defaultBottomGeometry();
        _geometryLoaded = true;
        _isGeometryReady.value = true;
    });

    function geomRef(): Ref<PanelGeometry> {
        return panelMode.value === "side" ? _sideGeometry : _bottomGeometry;
    }

    function minW(): number { return panelMode.value === "side" ? MIN_WIDTH_SIDE : MIN_WIDTH_BOTTOM; }
    function minH(): number { return panelMode.value === "side" ? MIN_HEIGHT_SIDE : MIN_HEIGHT_BOTTOM; }

    function makeCleanup(rafRef: { id: number }, onMove: (e: MouseEvent) => void, onUp: () => void): () => void {
        return () => {
            cancelAnimationFrame(rafRef.id);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }

    function startDrag(e: MouseEvent): void {
        const startX = e.clientX;
        const startY = e.clientY;
        const ref = geomRef();
        const startGeo = { ...ref.value };
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                ref.value = {
                    ...ref.value,
                    x: Math.max(0, Math.min(window.innerWidth - startGeo.width, startGeo.x + dx)),
                    y: Math.max(0, Math.min(window.innerHeight - TABBAR_HEIGHT, startGeo.y + dy)),
                };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeTop(e: MouseEvent): void {
        const startY = e.clientY;
        const ref = geomRef();
        const bottomEdge = ref.value.y + ref.value.height;
        const startH = ref.value.height;
        const mh = minH();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dy = ev.clientY - startY;
                const newH = Math.max(mh, Math.min(bottomEdge, startH - dy));
                ref.value = { ...ref.value, y: bottomEdge - newH, height: newH };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeBottom(e: MouseEvent): void {
        const startY = e.clientY;
        const ref = geomRef();
        const startH = ref.value.height;
        const startGeoY = ref.value.y;
        const mh = minH();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dy = ev.clientY - startY;
                const maxH = window.innerHeight - startGeoY;
                ref.value = { ...ref.value, height: Math.max(mh, Math.min(maxH, startH + dy)) };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeLeft(e: MouseEvent): void {
        const startX = e.clientX;
        const ref = geomRef();
        const rightEdge = ref.value.x + ref.value.width;
        const startW = ref.value.width;
        const mw = minW();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const newW = Math.max(mw, Math.min(rightEdge, startW - dx));
                ref.value = { ...ref.value, x: rightEdge - newW, width: newW };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function startResizeRight(e: MouseEvent): void {
        const startX = e.clientX;
        const ref = geomRef();
        const startW = ref.value.width;
        const startGeoX = ref.value.x;
        const mw = minW();
        const raf = { id: 0 };

        const onMove = (ev: MouseEvent): void => {
            cancelAnimationFrame(raf.id);
            raf.id = requestAnimationFrame(() => {
                const dx = ev.clientX - startX;
                const maxW = window.innerWidth - startGeoX;
                ref.value = { ...ref.value, width: Math.max(mw, Math.min(maxW, startW + dx)) };
            });
        };

        const onUp = (): void => {
            cancelAnimationFrame(raf.id);
            _activeCleanup = null;
            savePanelGeometry(panelMode.value, ref.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        _activeCleanup = makeCleanup(raf, onMove, onUp);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    function resetGeometry(): void {
        if (panelMode.value === "side") {
            _sideGeometry.value = defaultSideGeometry();
            savePanelGeometry("side", _sideGeometry.value);
        } else {
            _bottomGeometry.value = defaultBottomGeometry();
            savePanelGeometry("bottom", _bottomGeometry.value);
        }
    }

    onScopeDispose(() => { _activeCleanup?.(); });

    return {
        geometry,
        isGeometryReady: _isGeometryReady,
        startDrag,
        startResizeTop,
        startResizeBottom,
        startResizeLeft,
        startResizeRight,
        resetGeometry,
    };
}

/** @internal — resets module-level singletons for test isolation */
export function _resetGeometryForTesting(): void {
    _sideGeometry.value = { ...STATIC_SIDE };
    _bottomGeometry.value = { ...STATIC_BOTTOM };
    _isGeometryReady.value = false;
    _geometryLoaded = false;
    _activeCleanup = null;
}

/** @internal — sets geometry for a specific mode in tests */
export function _setGeometryForTesting(mode: PanelMode, geo: PanelGeometry): void {
    if (mode === "side") _sideGeometry.value = { ...geo };
    else _bottomGeometry.value = { ...geo };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run -- usePanelGeometry
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/panel/composables/usePanelGeometry.ts \
        packages/devtools/src/features/panel/composables/usePanelGeometry.test.ts
git commit -m "feat(devtools): add usePanelGeometry composable with drag and multi-edge resize"
```

---

## Task 3: Refactor `useFloatingPanel.ts`

**Files:**
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.ts`
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts`

- [ ] **Step 1: Rewrite `useFloatingPanel.ts`**

Replace the entire file with:

```ts
import { ref, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type { PanelMode, PanelGeometry } from "../../../shared/types/index";
import { loadPanelMode, savePanelMode } from "../../../shared/storage/devtoolsStorage";
import { usePanelGeometry } from "./usePanelGeometry";
import type { UsePanelGeometryReturn } from "./usePanelGeometry";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn extends UsePanelGeometryReturn {
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Current panel mode. */
    panelMode: Ref<PanelMode>;
    /** Switch panel mode and persist to IndexedDB. */
    switchMode: (mode: PanelMode) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

// Module-level singletons so state persists across mode switches
const _isOpen = ref(false);
const _panelMode = ref<PanelMode>("side");
let _panelModeLoaded = false;

/**
 * Composable for devtools panel state.
 * Manages open/close, mode (bottom/side), and delegates all geometry to usePanelGeometry.
 *
 * @example
 * ```ts
 * const { geometry, isGeometryReady, isOpen, panelMode, startDrag, startResizeLeft,
 *         startResizeTop, startResizeBottom, startResizeRight, switchMode, toggle, close,
 *         resetGeometry } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const isOpen = _isOpen;
    const panelMode = _panelMode;

    onMounted(async () => {
        if (_panelModeLoaded) return;
        const savedMode = await loadPanelMode();
        _panelMode.value = savedMode;
        _panelModeLoaded = true;
    });

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    function switchMode(mode: PanelMode): void {
        _panelMode.value = mode;
        savePanelMode(mode);
    }

    const geometry = usePanelGeometry(panelMode);

    onScopeDispose(() => {});

    return {
        isOpen,
        panelMode,
        toggle,
        close,
        switchMode,
        ...geometry,
    };
}

/** @internal — resets module-level singletons for test isolation */
export function _resetPanelModeForTesting(): void {
    _isOpen.value = false;
    _panelMode.value = "side";
    _panelModeLoaded = false;
}
```

- [ ] **Step 2: Rewrite `useFloatingPanel.test.ts`**

Replace the entire file with:

```ts
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
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run -- useFloatingPanel
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/panel/composables/useFloatingPanel.ts \
        packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts
git commit -m "refactor(devtools): useFloatingPanel delegates geometry to usePanelGeometry"
```

---

## Task 4: Remove deprecated storage functions

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.test.ts`

- [ ] **Step 1: Remove from `devtoolsStorage.ts`**

Remove from the `KEYS` const:
```ts
panelHeight: "vmd:panel-height",     // delete this line
panelSideWidth: "vmd:panel-side-width",  // delete this line
```

Remove these four functions entirely (their JSDoc + the async function body):
- `loadPanelHeight`
- `savePanelHeight`
- `loadPanelSideWidth`
- `savePanelSideWidth`

- [ ] **Step 2: Remove from `devtoolsStorage.test.ts`**

Remove from the import list: `loadPanelHeight`, `savePanelHeight`, `loadPanelSideWidth`, `savePanelSideWidth`

Remove the corresponding `describe` blocks:
- `describe("panel height", ...)` 
- `describe("side panel width", ...)`

- [ ] **Step 3: Run the full devtools test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS — no references to removed functions remain.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.ts \
        packages/devtools/src/shared/storage/devtoolsStorage.test.ts
git commit -m "refactor(devtools): remove deprecated panel height and side-width storage functions"
```

---

## Task 5: Update `SidePanel.vue`

**Files:**
- Modify: `packages/devtools/src/features/panel/components/SidePanel.vue`

- [ ] **Step 1: Replace `SidePanel.vue`**

Replace the entire file:

```vue
<!-- Right-side devtools panel with free-floating drag and 3-edge resize. -->
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
import TabBar from "./TabBar.vue";

const {
    geometry, isGeometryReady, isOpen, panelMode,
    startDrag, startResizeTop, startResizeBottom, startResizeLeft,
    switchMode, close, resetGeometry,
} = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
const { toggleSettings } = useNetworkLayout();
</script>

<template>
    <!-- Launcher pill — shown when panel is closed -->
    <button
        v-if="!isOpen"
        data-vmd-launcher
        class="launcher-pill"
        title="Open vue-muza devtools"
        @click="() => useFloatingPanel().toggle()"
    >
        <span class="launcher-icon">▲▲</span>
        <span>vue-muza</span>
    </button>

    <!-- Side panel -->
    <Transition name="panel">
        <div
            v-if="isOpen"
            data-vmd-panel
            class="side-panel"
            :style="{
                left: `${geometry.x}px`,
                top: `${geometry.y}px`,
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
                opacity: isGeometryReady ? 1 : 0,
            }"
        >
            <!-- Resize handles -->
            <div class="resize-handle resize-left"   @mousedown.prevent="startResizeLeft" />
            <div class="resize-handle resize-top"    @mousedown.prevent="startResizeTop" />
            <div class="resize-handle resize-bottom" @mousedown.prevent="startResizeBottom" />

            <div class="panel-body">
                <TabBar
                    :tabs="registeredTabs"
                    :active-tab-id="activeTabId ?? null"
                    :select-tab="setActiveTab"
                    :panel-mode="panelMode"
                    :start-drag="startDrag"
                    @close="close"
                    @update:panel-mode="switchMode"
                    @settings="toggleSettings"
                    @reset-geometry="resetGeometry"
                />
                <div class="panel-content">
                    <component :is="activeTab?.component" v-if="activeTab" />
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.launcher-pill {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    background: var(--dt-primary);
    border-radius: 99px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px oklch(65% 0.25 280 / 0.35);
    transition: transform 150ms ease-out, box-shadow 150ms ease-out;
    pointer-events: auto;
}
.launcher-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(65% 0.25 280 / 0.5);
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
.launcher-icon { font-size: 11px; }

.side-panel {
    position: fixed;
    z-index: 99998;
    display: flex;
    flex-direction: row;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 14px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: -8px 0 40px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04);
    /* No opacity transition — instant reveal after geometry loads */
}

.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 1;
    transition: background 150ms ease-out;
}
.resize-handle:hover { background: var(--dt-primary); }

.resize-left {
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    cursor: col-resize;
}
.resize-top {
    top: 0;
    left: 12px;
    right: 12px;
    height: 4px;
    cursor: row-resize;
}
.resize-bottom {
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 4px;
    cursor: row-resize;
}

.panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

.panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.panel-enter-active {
    transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out;
}
.panel-leave-active {
    transition: transform 160ms ease-in, opacity 160ms ease-in;
}
.panel-enter-from,
.panel-leave-to {
    transform: translateX(12px);
    opacity: 0;
}
</style>
```

Note: the launcher pill's `@click` now calls `useFloatingPanel().toggle()` directly since `toggle` wasn't destructured above to keep it out of template bindings. Alternatively destructure `toggle` too — add `toggle` to the destructuring in `<script setup>` and use `@click="toggle"`.

**Correction** — add `toggle` to the destructuring:

```ts
const {
    geometry, isGeometryReady, isOpen, panelMode,
    startDrag, startResizeTop, startResizeBottom, startResizeLeft,
    switchMode, toggle, close, resetGeometry,
} = useFloatingPanel();
```

And in template: `@click="toggle"`.

- [ ] **Step 2: Run the test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/panel/components/SidePanel.vue
git commit -m "feat(devtools): SidePanel — geometry-based positioning and 3 resize handles"
```

---

## Task 6: Update `FloatingPanel.vue`

**Files:**
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue`

- [ ] **Step 1: Replace `FloatingPanel.vue`**

Replace the entire file:

```vue
<!-- Bottom devtools panel with free-floating drag and 3-edge resize. -->
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
import TabBar from "./TabBar.vue";

const {
    geometry, isGeometryReady, isOpen, panelMode,
    startDrag, startResizeTop, startResizeLeft, startResizeRight,
    switchMode, toggle, close, resetGeometry,
} = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
const { toggleSettings } = useNetworkLayout();
</script>

<template>
    <!-- Launcher pill — shown when panel is closed -->
    <button
        v-if="!isOpen"
        data-vmd-launcher
        class="launcher-pill"
        title="Open vue-muza devtools"
        @click="toggle"
    >
        <span class="launcher-icon">▲▲</span>
        <span>vue-muza</span>
    </button>

    <!-- Bottom panel -->
    <Transition name="panel">
        <div
            v-if="isOpen"
            data-vmd-panel
            class="devtools-panel"
            :style="{
                left: `${geometry.x}px`,
                top: `${geometry.y}px`,
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
                opacity: isGeometryReady ? 1 : 0,
            }"
        >
            <!-- Resize handles -->
            <div class="resize-handle resize-top"   @mousedown.prevent="startResizeTop" />
            <div class="resize-handle resize-left"  @mousedown.prevent="startResizeLeft" />
            <div class="resize-handle resize-right" @mousedown.prevent="startResizeRight" />

            <TabBar
                :tabs="registeredTabs"
                :active-tab-id="activeTabId ?? null"
                :select-tab="setActiveTab"
                :panel-mode="panelMode"
                :start-drag="startDrag"
                @close="close"
                @update:panel-mode="switchMode"
                @settings="toggleSettings"
                @reset-geometry="resetGeometry"
            />

            <div class="panel-content">
                <component :is="activeTab?.component" v-if="activeTab" />
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.launcher-pill {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    background: var(--dt-primary);
    border-radius: 99px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px oklch(65% 0.25 280 / 0.35);
    transition: transform 150ms ease-out, box-shadow 150ms ease-out;
    pointer-events: auto;
}
.launcher-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(65% 0.25 280 / 0.5);
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
.launcher-icon { font-size: 11px; }

.devtools-panel {
    position: fixed;
    z-index: 99998;
    display: flex;
    flex-direction: column;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 12px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 -4px 32px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04);
}

.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 1;
    transition: background 150ms ease-out;
}
.resize-handle:hover { background: var(--dt-primary); }

.resize-top {
    top: 0;
    left: 12px;
    right: 12px;
    height: 4px;
    cursor: row-resize;
}
.resize-left {
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    cursor: col-resize;
}
.resize-right {
    right: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    cursor: col-resize;
}

.panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.panel-enter-active {
    transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out;
}
.panel-leave-active {
    transition: transform 160ms ease-in, opacity 160ms ease-in;
}
.panel-enter-from,
.panel-leave-to {
    transform: translateY(12px);
    opacity: 0;
}
</style>
```

- [ ] **Step 2: Run the test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/panel/components/FloatingPanel.vue
git commit -m "feat(devtools): FloatingPanel — geometry-based positioning and 3 resize handles"
```

---

## Task 7: Update `TabBar.vue` — logo drag handle

**Files:**
- Modify: `packages/devtools/src/features/panel/components/TabBar.vue`

- [ ] **Step 1: Replace `TabBar.vue`**

Replace the entire file:

```vue
<!-- Horizontal tab strip with drag handle in the logo pill. -->
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DevtoolsTab, PanelMode } from "../../../shared/types/index";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    selectTab: (id: string) => void;
    panelMode: PanelMode;
    startDrag: (e: MouseEvent) => void;
}>();

defineEmits<{
    close: [];
    "update:panelMode": [PanelMode];
    settings: [];
    "resetGeometry": [];
}>();
</script>

<template>
    <div class="tab-bar">
        <!-- Logo pill — doubles as drag handle on hover -->
        <div class="logo-pill" @mousedown.prevent="startDrag">
            <span class="logo-icon">▲▲</span>
            <span class="logo-drag-icon">⠿</span>
            <span class="logo-text">vue-muza</span>
        </div>

        <div class="tab-list">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                data-vmd-tab
                class="tab-btn"
                :class="tab.id === activeTabId ? 'tab-btn--active' : 'tab-btn--inactive'"
                @click="selectTab(tab.id)"
            >
                <Icon
                    v-if="typeof tab.icon === 'string'"
                    :icon="tab.icon"
                    width="13"
                    height="13"
                />
                <component
                    :is="tab.icon"
                    v-else-if="tab.icon"
                    width="13"
                    height="13"
                />
                <span>{{ tab.label }}</span>
            </button>
        </div>

        <!-- Mode switcher -->
        <div class="mode-switcher">
            <button
                class="mode-btn"
                :class="{ 'mode-btn--active': panelMode === 'bottom' }"
                title="Bottom panel"
                @click="$emit('update:panelMode', 'bottom')"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.35"/>
                    <rect x="1" y="9.5" width="12" height="3.5" rx="1.5" fill="currentColor"/>
                </svg>
            </button>
            <button
                class="mode-btn"
                :class="{ 'mode-btn--active': panelMode === 'side' }"
                title="Side panel"
                @click="$emit('update:panelMode', 'side')"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="7" height="12" rx="1.5" fill="currentColor" opacity="0.35"/>
                    <rect x="9.5" y="1" width="3.5" height="12" rx="1.5" fill="currentColor"/>
                </svg>
            </button>
        </div>

        <div class="mode-divider" />

        <button class="settings-btn" title="Layout settings" @click="$emit('settings')">
            <Icon icon="lucide:settings-2" width="14" height="14" />
        </button>

        <button class="close-btn" title="Close devtools" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.tab-bar {
    display: flex;
    align-items: center;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}

/* Logo pill — drag handle */
.logo-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px 0 9px;
    margin: 0 6px 0 8px;
    background: var(--dt-primary);
    border-radius: 99px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    user-select: none;
    flex-shrink: 0;
    cursor: default;
    transition: background 150ms ease-out;
}
.logo-pill:hover {
    cursor: grab;
    background: color-mix(in oklch, var(--dt-primary) 85%, white);
}
.logo-pill:active { cursor: grabbing; }

.logo-icon { font-size: 10px; }
.logo-drag-icon { font-size: 14px; display: none; }
.logo-text { font-size: 12px; }

.logo-pill:hover .logo-icon      { display: none; }
.logo-pill:hover .logo-drag-icon { display: inline; }

.tab-list {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 6px;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
}
.tab-list::-webkit-scrollbar { display: none; }

.tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
}
.tab-btn:active { transform: scale(0.97); }
.tab-btn--active {
    color: var(--dt-vue-green);
    border-bottom-color: var(--dt-vue-green);
}
.tab-btn--inactive { color: var(--dt-foreground-muted); }
.tab-btn--inactive:hover {
    color: var(--dt-foreground-secondary);
    background: var(--dt-surface);
}

.mode-switcher {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    flex-shrink: 0;
}
.mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.mode-btn:active { transform: scale(0.97); }
.mode-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
}
.mode-btn--active {
    background: var(--dt-surface-raised);
    color: var(--dt-primary);
}
.mode-btn--active:hover { color: var(--dt-primary); }

.mode-divider {
    width: 1px;
    height: 18px;
    background: var(--dt-border-subtle);
    margin-right: 4px;
    flex-shrink: 0;
}

.settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.settings-btn:active { transform: scale(0.97); }
.settings-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
}

.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.close-btn:active { transform: scale(0.97); }
.close-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground);
}
</style>
```

- [ ] **Step 2: Run the test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/panel/components/TabBar.vue
git commit -m "feat(devtools): TabBar — logo pill as drag handle with hover icon swap"
```

---

## Task 8: Add Reset layout to `NetworkTab.vue`

**Files:**
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

- [ ] **Step 1: Add `useFloatingPanel` import and `resetGeometry` to script**

In `NetworkTab.vue`, find the existing `<script setup>` imports. Add:

```ts
import { useFloatingPanel } from "../../panel/composables/useFloatingPanel";
```

And in the setup body where other composables are called, add:

```ts
const { resetGeometry } = useFloatingPanel();
```

- [ ] **Step 2: Add divider + Reset layout button to the settings menu template**

Find the settings menu `<div v-if="settingsOpen" class="settings-menu">` block. After the existing two `<button class="settings-item">` elements, add:

```html
<div class="settings-divider" />
<button class="settings-item settings-item--reset" @click="resetGeometry">
    <Icon icon="lucide:rotate-ccw" width="12" height="12" class="reset-icon" />
    Reset layout
</button>
```

- [ ] **Step 3: Add divider and reset-item styles**

In the `<style scoped>` section of `NetworkTab.vue`, add after the existing `.settings-check--on` rule:

```css
.settings-divider {
    height: 1px;
    background: var(--dt-border-subtle);
    margin: 4px 0;
}
.settings-item--reset {
    color: var(--dt-foreground-muted);
    gap: 8px;
}
.settings-item--reset:hover {
    color: var(--dt-foreground);
    background: var(--dt-surface-raised);
}
.reset-icon { flex-shrink: 0; }
```

- [ ] **Step 4: Run the full test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "feat(devtools): add Reset layout option to settings menu"
```

---

## Final verification

- [ ] **Run the full test suite one last time**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all PASS, zero failures.

- [ ] **Build to verify TypeScript compilation**

```bash
pnpm --filter @ametie/vue-muza-devtools build
```

Expected: clean build, no TS errors.
