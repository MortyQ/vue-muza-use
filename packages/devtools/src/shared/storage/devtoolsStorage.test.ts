import { describe, it, expect, vi, beforeEach } from "vitest";

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
    loadPanelHeight,
    savePanelHeight,
    loadPanelMode,
    savePanelMode,
    loadPanelSideWidth,
    savePanelSideWidth,
    loadPayloadFormat,
    savePayloadFormat,
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

describe("panel height", () => {
    it("loadPanelHeight calls get with correct key", async () => {
        vi.mocked(get).mockResolvedValue(400);
        const result = await loadPanelHeight();
        expect(get).toHaveBeenCalledWith("vmd:panel-height");
        expect(result).toBe(400);
    });

    it("savePanelHeight calls set with correct key", async () => {
        await savePanelHeight(400);
        expect(set).toHaveBeenCalledWith("vmd:panel-height", 400);
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

describe("loadPanelSideWidth / savePanelSideWidth", () => {
    it("loadPanelSideWidth calls get with correct key and returns stored number", async () => {
        vi.mocked(get).mockResolvedValue(320);
        const result = await loadPanelSideWidth();
        expect(get).toHaveBeenCalledWith("vmd:panel-side-width");
        expect(result).toBe(320);
    });

    it("loadPanelSideWidth returns undefined when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadPanelSideWidth();
        expect(get).toHaveBeenCalledWith("vmd:panel-side-width");
        expect(result).toBeUndefined();
    });

    it("savePanelSideWidth calls set with correct key and value", async () => {
        await savePanelSideWidth(320);
        expect(set).toHaveBeenCalledWith("vmd:panel-side-width", 320);
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
