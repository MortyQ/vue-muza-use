import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelHeight: vi.fn().mockResolvedValue(undefined),
    savePanelHeight: vi.fn().mockResolvedValue(undefined),
}));

import { loadPanelHeight, savePanelHeight } from "../../../shared/storage/devtoolsStorage";
import { useFloatingPanel } from "./useFloatingPanel";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("initial state", () => {
    it("starts with height 360 and closed", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(result.height.value).toBe(360);
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("storage hydration", () => {
    it("loads saved height on mount", async () => {
        vi.mocked(loadPanelHeight).mockResolvedValue(500);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.height.value).toBe(500);
        unmount();
    });

    it("ignores undefined saved height", async () => {
        vi.mocked(loadPanelHeight).mockResolvedValue(undefined);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.height.value).toBe(360);
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

    it("close sets isOpen to false when open", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.toggle();
        result.close();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("height resize", () => {
    it("dragging up increases height", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 360;

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 300 }));
        await nextTick();

        expect(result.height.value).toBe(460);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("dragging down decreases height", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 400;

        result.startResizeHeight({ clientY: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 350 }));
        await nextTick();

        expect(result.height.value).toBe(350);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("height cannot go below MIN_HEIGHT (200)", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 220;

        result.startResizeHeight({ clientY: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 500 }));
        await nextTick();

        expect(result.height.value).toBe(200);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("saves height to storage on mouseup", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 400;

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 350 }));
        window.dispatchEvent(new MouseEvent("mouseup"));
        await nextTick();

        expect(savePanelHeight).toHaveBeenCalledWith(450);
        unmount();
    });

    it("mouseup stops resize — further mousemove has no effect", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 360;

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(new MouseEvent("mouseup"));
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 100 }));
        await nextTick();

        expect(result.height.value).toBe(360);
        unmount();
    });
});
