import { get, set } from "idb-keyval";

const KEYS = {
    panelPosition: "vmd:panel-position",
    panelSize: "vmd:panel-size",
    activeTab: "vmd:active-tab",
} as const;

export async function loadPanelPosition(): Promise<{ x: number; y: number } | undefined> {
    return get<{ x: number; y: number }>(KEYS.panelPosition);
}

export async function savePanelPosition(pos: { x: number; y: number }): Promise<void> {
    return set(KEYS.panelPosition, pos);
}

export async function loadPanelSize(): Promise<{ width: number; height: number } | undefined> {
    return get<{ width: number; height: number }>(KEYS.panelSize);
}

export async function savePanelSize(size: { width: number; height: number }): Promise<void> {
    return set(KEYS.panelSize, size);
}

export async function loadActiveTab(): Promise<string | undefined> {
    return get<string>(KEYS.activeTab);
}

export async function saveActiveTab(id: string): Promise<void> {
    return set(KEYS.activeTab, id);
}
