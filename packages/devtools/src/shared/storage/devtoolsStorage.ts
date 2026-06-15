import { get, set } from "idb-keyval";
import type { PanelMode } from "../types/index";

const KEYS = {
    panelPosition: "vmd:panel-position",
    panelSize: "vmd:panel-size",
    panelHeight: "vmd:panel-height",
    panelMode: "vmd:panel-mode",
    panelSideWidth: "vmd:panel-side-width",
    activeTab: "vmd:active-tab",
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
 * Loads the saved panel mode from IndexedDB. Returns "bottom" if not previously saved.
 */
export async function loadPanelMode(): Promise<PanelMode> {
    return (await get<PanelMode>(KEYS.panelMode)) ?? "bottom";
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
