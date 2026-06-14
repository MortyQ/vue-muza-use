import { registerInstance, unregisterInstance, updateInstanceState } from "../store/devtoolsStore";
import type { DevtoolsInstanceOptions, DevtoolsInstanceState } from "../types/index";

/**
 * Called when a useApi composable instance is created. Registers it in the store.
 */
export function onInstanceCreated(
    id: string,
    url: string | undefined,
    options: DevtoolsInstanceOptions,
): void {
    registerInstance(id, url, options);
}

/**
 * Called when a useApi composable instance is destroyed. Removes it from the store.
 */
export function onInstanceDestroyed(id: string): void {
    unregisterInstance(id);
}

/**
 * Called when a useApi composable's reactive state changes. Merges update into store.
 */
export function onStateUpdate(id: string, partial: Partial<DevtoolsInstanceState>): void {
    updateInstanceState(id, partial);
}
