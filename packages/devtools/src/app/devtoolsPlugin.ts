import { createApp } from "vue";
import DevtoolsApp from "./DevtoolsApp.vue";
import "../style.css";

const ROOT_ID = "vue-muza-devtools-root";

declare global {
    interface Window { __vmdPendingCss?: string; }
}

/**
 * Mounts the devtools Vue app into document.body.
 *
 * In production builds, all CSS (Tailwind, CSS variables, scoped component styles) is
 * pre-collected into window.__vmdPendingCss by the cssInjectedByJs build plugin, and
 * the app is mounted inside a Shadow DOM root for full CSS isolation from the consumer.
 *
 * In dev mode (Vite source aliases, no build plugin), window.__vmdPendingCss is absent
 * and the app mounts directly — CSS is injected into <head> by Vite as normal.
 *
 * Safe to call multiple times — guards against double-mount.
 */
export function mountDevtoolsPanel(): void {
    if (document.getElementById(ROOT_ID)) return;

    const host = document.createElement("div");
    host.id = ROOT_ID;
    Object.assign(host.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "0",
        height: "0",
        overflow: "visible",
        zIndex: "9999",
        pointerEvents: "none",
    });
    document.body.appendChild(host);

    const pendingCss = window.__vmdPendingCss;
    window.__vmdPendingCss = undefined;

    if (pendingCss) {
        // Production: full CSS isolation via Shadow DOM
        const shadow = host.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = pendingCss;
        shadow.appendChild(style);
        const mountPoint = document.createElement("div");
        shadow.appendChild(mountPoint);
        createApp(DevtoolsApp).mount(mountPoint);
    } else {
        // Dev mode: mount directly, Vite injects CSS into <head>
        createApp(DevtoolsApp).mount(host);
    }
}
