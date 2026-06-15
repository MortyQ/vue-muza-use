import type { App } from "vue";
import type { DevtoolsBridge, DevtoolsOptions, DevtoolsTab } from "../shared/types/index";
import { initDevtoolsStore } from "../shared/store/devtoolsStore";
import { registerTab } from "../shared/plugins/tabRegistry";
import { onInstanceCreated, onInstanceDestroyed, onStateUpdate } from "../shared/instrumentation/instanceTracker";
import { onRequestStart, onRequestEnd } from "../shared/instrumentation/requestTracker";
import { mountDevtoolsPanel } from "./devtoolsPlugin";
import { instancesTab } from "../features/instances/index";
import { networkTab } from "../features/network/index";
import { timelineTab } from "../features/timeline/index";

/**
 * Entry point called by `use-api` via dynamic import.
 * Initialises the store, registers built-in and custom tabs, mounts the panel,
 * and returns the bridge that `useApi` uses to push instrumentation events.
 */
export function createBridge(options: DevtoolsOptions, _app: App): DevtoolsBridge {
    initDevtoolsStore(options);

    // registerTab(instancesTab);
    registerTab(networkTab);
    // registerTab(timelineTab);

    if (options.tabs) {
        options.tabs.forEach((tab) => registerTab(tab as DevtoolsTab));
    }

    mountDevtoolsPanel();

    return {
        onInstanceCreated,
        onInstanceDestroyed,
        onStateUpdate,
        onRequestStart,
        onRequestEnd,
    };
}
