import { get, set } from "idb-keyval";
import type { PanelMode, PayloadFormat } from "../types/index";

const KEYS = {
    panelPosition: "vmd:panel-position",
    panelSize: "vmd:panel-size",
    panelHeight: "vmd:panel-height",
    panelMode: "vmd:panel-mode",
    panelSideWidth: "vmd:panel-side-width",
    activeTab: "vmd:active-tab",
    networkToolbarVisible: "vmd:network-toolbar-visible",
    networkFilterVisible: "vmd:network-filter-visible",
    splitPayloadWidth: "vmd:split-payload-width",
    splitPayloadHeight: "vmd:split-payload-height",
    listWidth: "vmd:list-width",
    payloadFormat: "vmd:payload-format",
    responseFormat: "vmd:response-format",
} as const;

/**
 * Loads the saved panel position from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadPanelPosition(): Promise<{ x: number; y: number } | undefined> {
    return get<{ x: number; y: number }>(KEYS.panelPosition);
}

/**
 * Saves the panel position to IndexedDB.
 */
export async function savePanelPosition(pos: { x: number; y: number }): Promise<void> {
    return set(KEYS.panelPosition, pos);
}

/**
 * Loads the saved panel size from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadPanelSize(): Promise<{ width: number; height: number } | undefined> {
    return get<{ width: number; height: number }>(KEYS.panelSize);
}

/**
 * Saves the panel size to IndexedDB.
 */
export async function savePanelSize(size: { width: number; height: number }): Promise<void> {
    return set(KEYS.panelSize, size);
}

/**
 * Loads the last active tab id from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadActiveTab(): Promise<string | undefined> {
    return get<string>(KEYS.activeTab);
}

/**
 * Saves the active tab id to IndexedDB.
 */
export async function saveActiveTab(id: string): Promise<void> {
    return set(KEYS.activeTab, id);
}

/**
 * Loads the saved panel height from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadPanelHeight(): Promise<number | undefined> {
    return get<number>(KEYS.panelHeight);
}

/**
 * Saves the panel height to IndexedDB.
 */
export async function savePanelHeight(height: number): Promise<void> {
    return set(KEYS.panelHeight, height);
}

/**
 * Loads the saved panel mode from IndexedDB. Returns "side" if not previously saved.
 */
export async function loadPanelMode(): Promise<PanelMode> {
    return (await get<PanelMode>(KEYS.panelMode)) ?? "side";
}

/**
 * Saves the panel mode to IndexedDB.
 */
export async function savePanelMode(mode: PanelMode): Promise<void> {
    return set(KEYS.panelMode, mode);
}

/**
 * Loads the saved side panel width from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadPanelSideWidth(): Promise<number | undefined> {
    return get<number>(KEYS.panelSideWidth);
}

/**
 * Saves the side panel width to IndexedDB.
 */
export async function savePanelSideWidth(width: number): Promise<void> {
    return set(KEYS.panelSideWidth, width);
}

/**
 * Loads the network toolbar visibility state from IndexedDB. Returns true if not previously saved.
 */
export async function loadNetworkToolbarVisible(): Promise<boolean> {
    return (await get<boolean>(KEYS.networkToolbarVisible)) ?? true;
}

/**
 * Saves the network toolbar visibility state to IndexedDB.
 */
export async function saveNetworkToolbarVisible(value: boolean): Promise<void> {
    return set(KEYS.networkToolbarVisible, value);
}

/**
 * Loads the network filter visibility state from IndexedDB. Returns true if not previously saved.
 */
export async function loadNetworkFilterVisible(): Promise<boolean> {
    return (await get<boolean>(KEYS.networkFilterVisible)) ?? true;
}

/**
 * Saves the network filter visibility state to IndexedDB.
 */
export async function saveNetworkFilterVisible(value: boolean): Promise<void> {
    return set(KEYS.networkFilterVisible, value);
}

/**
 * Loads the split payload width from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadSplitPayloadWidth(): Promise<number | undefined> {
    return get<number>(KEYS.splitPayloadWidth);
}

/**
 * Saves the split payload width to IndexedDB.
 */
export async function saveSplitPayloadWidth(width: number): Promise<void> {
    return set(KEYS.splitPayloadWidth, width);
}

/**
 * Loads the saved split payload height (stacked mode) from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadSplitPayloadHeight(): Promise<number | undefined> {
    return get<number>(KEYS.splitPayloadHeight);
}

/**
 * Saves the split payload height (stacked mode) to IndexedDB.
 */
export async function saveSplitPayloadHeight(height: number): Promise<void> {
    return set(KEYS.splitPayloadHeight, height);
}

/**
 * Loads the saved payload viewer format from IndexedDB. Returns "kv" if not previously saved.
 */
export async function loadPayloadFormat(): Promise<PayloadFormat> {
    return (await get<PayloadFormat>(KEYS.payloadFormat)) ?? "kv";
}

/**
 * Saves the payload viewer format to IndexedDB.
 */
export async function savePayloadFormat(format: PayloadFormat): Promise<void> {
    return set(KEYS.payloadFormat, format);
}

/**
 * Loads the saved response viewer format from IndexedDB. Returns "json" if not previously saved.
 */
export async function loadResponseFormat(): Promise<PayloadFormat> {
    return (await get<PayloadFormat>(KEYS.responseFormat)) ?? "json";
}

/**
 * Saves the response viewer format to IndexedDB.
 */
export async function saveResponseFormat(format: PayloadFormat): Promise<void> {
    return set(KEYS.responseFormat, format);
}

/**
 * Loads the saved request list width from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadListWidth(): Promise<number | undefined> {
    return get<number>(KEYS.listWidth);
}

/**
 * Saves the request list width to IndexedDB.
 */
export async function saveListWidth(width: number): Promise<void> {
    return set(KEYS.listWidth, width);
}
