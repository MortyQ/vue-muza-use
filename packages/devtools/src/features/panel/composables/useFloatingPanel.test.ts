import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelHeight: vi.fn().mockResolvedValue(undefined),
    savePanelHeight: vi.fn().mockResolvedValue(undefined),
    loadPanelMode: vi.fn().mockResolvedValue("bottom"),
    savePanelMode: vi.fn().mockResolvedValue(undefined),
    loadPanelSideWidth: vi.fn().mockResolvedValue(undefined),
    savePanelSideWidth: vi.fn().mockResolvedValue(undefined),
}));

import { loadPanelHeight, savePanelHeight, loadPanelMode, savePanelMode, loadPanelSideWidth, savePanelSideWidth } from "../../../shared/storage/devtoolsStorage";
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
});

describe("initial state", () => {
    it("starts with height 360, sideWidth 380, mode 'side', and closed", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(result.height.value).toBe(360);
        expect(result.sideWidth.value).toBe(380);
        expect(result.panelMode.value).toBe("side");
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

describe("panel mode", () => {
    it("switchMode updates panelMode and saves to storage", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.switchMode("side");
        expect(result.panelMode.value).toBe("side");
        expect(savePanelMode).toHaveBeenCalledWith("side");
        unmount();
    });

    it("panelMode is shared across multiple composable calls", () => {
        const { result: result1, unmount: unmount1 } = withSetup(() => useFloatingPanel());
        const { result: result2, unmount: unmount2 } = withSetup(() => useFloatingPanel());

        result1.switchMode("side");
        expect(result2.panelMode.value).toBe("side");

        unmount1();
        unmount2();
    });
});

describe("side width resize", () => {
    it("dragging left increases side width", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.sideWidth.value = 380;

        result.startResizeSideWidth({ clientX: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 250 }));
        await nextTick();

        expect(result.sideWidth.value).toBe(430);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("dragging right decreases side width", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.sideWidth.value = 380;

        result.startResizeSideWidth({ clientX: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 350 }));
        await nextTick();

        expect(result.sideWidth.value).toBe(330);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("side width cannot go below MIN_SIDE_WIDTH (280)", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.sideWidth.value = 300;

        result.startResizeSideWidth({ clientX: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 500 }));
        await nextTick();

        expect(result.sideWidth.value).toBe(280);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("side width cannot exceed MAX_SIDE_WIDTH (60% of window.innerWidth)", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        const maxW = Math.floor(window.innerWidth * 0.6);
        result.sideWidth.value = maxW - 10;

        result.startResizeSideWidth({ clientX: 500, preventDefault: vi.fn() } as unknown as MouseEvent);
        // Dragging far left would increase width well beyond the max
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 0 }));
        await nextTick();

        expect(result.sideWidth.value).toBe(maxW);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("saves side width to storage on mouseup", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.sideWidth.value = 380;

        result.startResizeSideWidth({ clientX: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 250 }));
        window.dispatchEvent(new MouseEvent("mouseup"));
        await nextTick();

        expect(savePanelSideWidth).toHaveBeenCalledWith(430);
        unmount();
    });

    it("mouseup stops resize — further mousemove has no effect", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.sideWidth.value = 380;

        result.startResizeSideWidth({ clientX: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(new MouseEvent("mouseup"));
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientX: 100 }));
        await nextTick();

        expect(result.sideWidth.value).toBe(380);
        unmount();
    });
});

describe("storage hydration — side width", () => {
    it("loads saved side width on mount", async () => {
        vi.mocked(loadPanelSideWidth).mockResolvedValue(500);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.sideWidth.value).toBe(500);
        unmount();
    });

    it("ignores undefined saved side width", async () => {
        vi.mocked(loadPanelSideWidth).mockResolvedValue(undefined);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.sideWidth.value).toBe(380);
        unmount();
    });
});
