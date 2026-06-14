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
