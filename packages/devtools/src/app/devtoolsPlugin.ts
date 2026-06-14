import { createApp } from "vue";
import FloatingPanel from "../features/panel/components/FloatingPanel.vue";
import "../style.css";

const ROOT_ID = "vue-muza-devtools-root";

/**
 * Mounts an isolated Vue app into a dedicated DOM node appended to document.body.
 * Safe to call multiple times — guards against double-mount.
 * The container has zero dimensions and is fixed-positioned so it never affects document layout.
 */
export function mountDevtoolsPanel(): void {
    if (document.getElementById(ROOT_ID)) return;
    const container = document.createElement("div");
    container.id = ROOT_ID;
    Object.assign(container.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "0",
        height: "0",
        overflow: "visible",
        zIndex: "9999",
        pointerEvents: "none",
    });
    document.body.appendChild(container);
    const app = createApp(FloatingPanel);
    app.mount(container);
}
