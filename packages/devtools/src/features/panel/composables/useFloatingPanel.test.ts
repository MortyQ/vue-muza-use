import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelPosition: vi.fn().mockResolvedValue(undefined),
    savePanelPosition: vi.fn().mockResolvedValue(undefined),
    loadPanelSize: vi.fn().mockResolvedValue(undefined),
    savePanelSize: vi.fn().mockResolvedValue(undefined),
}));

import { loadPanelPosition, savePanelPosition, loadPanelSize } from "../../../shared/storage/devtoolsStorage";
import { useFloatingPanel } from "./useFloatingPanel";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("initial state", () => {
    it("starts with default position and size", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(result.position.value).toEqual({ x: 100, y: 100 });
        expect(result.size.value).toEqual({ width: 800, height: 500 });
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("storage hydration", () => {
    it("loads saved position on mount", async () => {
        vi.mocked(loadPanelPosition).mockResolvedValue({ x: 300, y: 200 });
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick(); // wait for async onMounted
        expect(result.position.value).toEqual({ x: 300, y: 200 });
        unmount();
    });

    it("loads saved size on mount", async () => {
        vi.mocked(loadPanelSize).mockResolvedValue({ width: 1000, height: 700 });
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.size.value).toEqual({ width: 1000, height: 700 });
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
        result.close();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("drag", () => {
    it("onDragStart + mousemove updates position", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.position.value = { x: 100, y: 100 };

        result.onDragStart({ clientX: 200, clientY: 150 } as MouseEvent);

        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 250, clientY: 180 }));
        await nextTick();

        expect(result.position.value).toEqual({ x: 150, y: 130 });
        unmount();
    });

    it("mouseup stops drag — further mousemove has no effect", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.position.value = { x: 100, y: 100 };

        result.onDragStart({ clientX: 200, clientY: 150 } as MouseEvent);
        window.dispatchEvent(new MouseEvent("mouseup"));
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 999, clientY: 999 }));
        await nextTick();

        expect(result.position.value).toEqual({ x: 100, y: 100 });
        unmount();
    });

    it("saves position to storage when it changes", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.position.value = { x: 42, y: 42 };
        await nextTick();
        expect(savePanelPosition).toHaveBeenCalledWith({ x: 42, y: 42 });
        unmount();
    });
});
