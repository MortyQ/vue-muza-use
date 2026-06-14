import { createApp } from "vue";
import FloatingPanel from "../features/panel/components/FloatingPanel.vue";

const ROOT_ID = "vue-muza-devtools-root";

/**
 * Mounts an isolated Vue app into a dedicated DOM node appended to document.body.
 * Safe to call multiple times — guards against double-mount.
 */
export function mountDevtoolsPanel(): void {
    if (document.getElementById(ROOT_ID)) return;
    const container = document.createElement("div");
    container.id = ROOT_ID;
    document.body.appendChild(container);
    createApp(FloatingPanel).mount(container);
}
