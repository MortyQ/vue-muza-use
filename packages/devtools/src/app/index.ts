import type { App } from "vue";
import type { DevtoolsBridge, DevtoolsOptions } from "../shared/types/index";
import { initDevtoolsStore } from "../shared/store/devtoolsStore";
import { registerTab } from "../shared/plugins/tabRegistry";
import { onInstanceCreated, onInstanceDestroyed, onStateUpdate } from "../shared/instrumentation/instanceTracker";
import { onRequestStart, onRequestEnd } from "../shared/instrumentation/requestTracker";
import { mountDevtoolsPanel } from "./devtoolsPlugin";

/**
 * Initialises the devtools store, mounts the panel, and returns the bridge
 * that `use-api` will use to push instrumentation events.
 * Feature tabs are registered separately — see registerBuiltinTabs().
 *
 * @example
 * ```ts
 * const bridge = createBridge({ enabled: true, maxHistory: 100 }, app);
 * bridge.onInstanceCreated(instanceId, state);
 * ```
 */
export function createBridge(options: DevtoolsOptions, _app: App): DevtoolsBridge {
    initDevtoolsStore(options);
    mountDevtoolsPanel();

    options.tabs?.forEach((tab) => registerTab(tab as DevtoolsOptions["tabs"] extends Array<infer T> ? T : never));

    return {
        onInstanceCreated,
        onInstanceDestroyed,
        onStateUpdate,
        onRequestStart,
        onRequestEnd,
    };
}
