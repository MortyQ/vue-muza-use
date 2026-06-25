import { describe, it, expect, vi, beforeEach } from "vitest";
import { reactive, isReactive } from "vue";

vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

import { get, set } from "idb-keyval";
import {
    loadPanelPosition,
    savePanelPosition,
    loadPanelSize,
    savePanelSize,
    loadActiveTab,
    saveActiveTab,
    loadPanelMode,
    savePanelMode,
    loadPayloadFormat,
    savePayloadFormat,
    loadNetworkToolbarVisible,
    saveNetworkToolbarVisible,
    loadNetworkFilterVisible,
    saveNetworkFilterVisible,
    loadResponseFormat,
    saveResponseFormat,
    loadSplitPayloadWidth,
    saveSplitPayloadWidth,
    loadPanelGeometry,
    savePanelGeometry,
} from "./devtoolsStorage";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("panel position", () => {
    it("loadPanelPosition calls get with correct key", async () => {
        vi.mocked(get).mockResolvedValue({ x: 10, y: 20 });
        const result = await loadPanelPosition();
        expect(get).toHaveBeenCalledWith("vmd:panel-position");
        expect(result).toEqual({ x: 10, y: 20 });
    });

    it("savePanelPosition calls set with correct key", async () => {
        await savePanelPosition({ x: 50, y: 60 });
        expect(set).toHaveBeenCalledWith("vmd:panel-position", { x: 50, y: 60 });
    });
});

describe("panel size", () => {
    it("loadPanelSize calls get with correct key", async () => {
        vi.mocked(get).mockResolvedValue({ width: 800, height: 500 });
        const result = await loadPanelSize();
        expect(get).toHaveBeenCalledWith("vmd:panel-size");
        expect(result).toEqual({ width: 800, height: 500 });
    });

    it("savePanelSize calls set with correct key", async () => {
        await savePanelSize({ width: 900, height: 600 });
        expect(set).toHaveBeenCalledWith("vmd:panel-size", { width: 900, height: 600 });
    });
});

describe("active tab", () => {
    it("loadActiveTab calls get with correct key", async () => {
        vi.mocked(get).mockResolvedValue("network");
        const result = await loadActiveTab();
        expect(get).toHaveBeenCalledWith("vmd:active-tab");
        expect(result).toBe("network");
    });

    it("saveActiveTab calls set with correct key", async () => {
        await saveActiveTab("instances");
        expect(set).toHaveBeenCalledWith("vmd:active-tab", "instances");
    });
});

describe("loadPanelMode / savePanelMode", () => {
    it("loadPanelMode calls get with correct key and returns stored value", async () => {
        vi.mocked(get).mockResolvedValue("side");
        const result = await loadPanelMode();
        expect(get).toHaveBeenCalledWith("vmd:panel-mode");
        expect(result).toBe("side");
    });

    it("loadPanelMode returns \"side\" as default when get resolves undefined", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadPanelMode();
        expect(get).toHaveBeenCalledWith("vmd:panel-mode");
        expect(result).toBe("side");
    });

    it("savePanelMode calls set with correct key and value", async () => {
        await savePanelMode("side");
        expect(set).toHaveBeenCalledWith("vmd:panel-mode", "side");
    });
});

describe("loadPayloadFormat / savePayloadFormat", () => {
    it("loadPayloadFormat returns \"kv\" as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadPayloadFormat();
        expect(get).toHaveBeenCalledWith("vmd:payload-format");
        expect(result).toBe("kv");
    });

    it("loadPayloadFormat returns saved value", async () => {
        vi.mocked(get).mockResolvedValue("json");
        const result = await loadPayloadFormat();
        expect(result).toBe("json");
    });

    it("savePayloadFormat calls set with correct key and value", async () => {
        await savePayloadFormat("json");
        expect(set).toHaveBeenCalledWith("vmd:payload-format", "json");
    });
});

describe("loadNetworkToolbarVisible / saveNetworkToolbarVisible", () => {
    it("loadNetworkToolbarVisible returns true as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadNetworkToolbarVisible();
        expect(get).toHaveBeenCalledWith("vmd:network-toolbar-visible");
        expect(result).toBe(true);
    });

    it("loadNetworkToolbarVisible returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const result = await loadNetworkToolbarVisible();
        expect(result).toBe(false);
    });

    it("saveNetworkToolbarVisible calls set with correct key and value", async () => {
        await saveNetworkToolbarVisible(false);
        expect(set).toHaveBeenCalledWith("vmd:network-toolbar-visible", false);
    });
});

describe("loadNetworkFilterVisible / saveNetworkFilterVisible", () => {
    it("loadNetworkFilterVisible returns true as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadNetworkFilterVisible();
        expect(get).toHaveBeenCalledWith("vmd:network-filter-visible");
        expect(result).toBe(true);
    });

    it("loadNetworkFilterVisible returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const result = await loadNetworkFilterVisible();
        expect(result).toBe(false);
    });

    it("saveNetworkFilterVisible calls set with correct key and value", async () => {
        await saveNetworkFilterVisible(false);
        expect(set).toHaveBeenCalledWith("vmd:network-filter-visible", false);
    });
});

describe("loadResponseFormat / saveResponseFormat", () => {
    it("loadResponseFormat returns \"json\" as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadResponseFormat();
        expect(get).toHaveBeenCalledWith("vmd:response-format");
        expect(result).toBe("json");
    });

    it("loadResponseFormat returns saved value", async () => {
        vi.mocked(get).mockResolvedValue("kv");
        const result = await loadResponseFormat();
        expect(result).toBe("kv");
    });

    it("saveResponseFormat calls set with correct key and value", async () => {
        await saveResponseFormat("kv");
        expect(set).toHaveBeenCalledWith("vmd:response-format", "kv");
    });
});

describe("loadSplitPayloadWidth / saveSplitPayloadWidth", () => {
    it("loadSplitPayloadWidth returns undefined when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadSplitPayloadWidth();
        expect(get).toHaveBeenCalledWith("vmd:split-payload-width");
        expect(result).toBeUndefined();
    });

    it("loadSplitPayloadWidth returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(280);
        const result = await loadSplitPayloadWidth();
        expect(result).toBe(280);
    });

    it("saveSplitPayloadWidth calls set with correct key and value", async () => {
        await saveSplitPayloadWidth(280);
        expect(set).toHaveBeenCalledWith("vmd:split-payload-width", 280);
    });
});

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

    it("savePanelGeometry strips Vue reactive proxy before writing to IDB", async () => {
        // Vue reactive proxies cannot be structured-cloned by IndexedDB.
        // savePanelGeometry must spread to a plain object before calling set().
        const reactiveGeo = reactive({ x: 100, y: 20, width: 380, height: 600 });
        expect(isReactive(reactiveGeo)).toBe(true);
        await savePanelGeometry("side", reactiveGeo);
        const stored = (set as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
        expect(isReactive(stored)).toBe(false);
        expect(stored).toEqual({ x: 100, y: 20, width: 380, height: 600 });
    });
});
