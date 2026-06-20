# Devtools CSS Isolation via Shadow DOM

**Date:** 2026-06-20  
**Semver impact:** `patch` — internal change only, no public API changes  
**Status:** Approved

## Problem

Consumer global CSS (e.g. `button { padding: ... }`, `* { line-height: 1.5 }`) leaks into the devtools panel because it is mounted as a regular DOM node in `document.body`. There is no browser-level boundary preventing consumer styles from matching elements inside the panel.

## Solution

Mount the devtools Vue app inside a Shadow DOM root. The shadow boundary is enforced by the browser — no external stylesheet can penetrate it.

## Architecture

### Files changed

| File | Change |
|------|--------|
| `packages/devtools/src/app/devtoolsPlugin.ts` | Use `attachShadow`, inject CSS into shadow root, mount Vue into inner div |
| `packages/devtools/vite.config.ts` | Remove `cssInjectedByJs()` plugin — CSS is now injected manually |
| `packages/devtools/src/style.css` | Replace `#vue-muza-devtools-root { }` selector with `:host { }` |
| `packages/devtools/src/app/devtoolsPlugin.test.ts` | Add test asserting shadow root exists and contains `<style>` |

### `devtoolsPlugin.ts` — new mounting flow

```ts
import { createApp } from "vue";
import DevtoolsApp from "./DevtoolsApp.vue";
import cssText from "../style.css?inline";

const ROOT_ID = "vue-muza-devtools-root";

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

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = cssText;
    shadow.appendChild(style);

    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);

    createApp(DevtoolsApp).mount(mountPoint);
}
```

### `style.css` — selector update

```css
/* Before */
#vue-muza-devtools-root {
    --dt-background: oklch(22% 0.025 250);
    /* ... */
}

/* After */
:host {
    --dt-background: oklch(22% 0.025 250);
    /* ... */
}
```

`:host` is the standard shadow DOM pseudo-selector referring to the host element (`#vue-muza-devtools-root`). CSS custom properties defined here cascade into the entire shadow tree normally.

### `vite.config.ts` — remove cssInjectedByJs

```ts
// Remove:
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

// Remove from plugins array:
cssInjectedByJs(),
```

CSS is no longer injected into `document.head`. It is injected into the shadow root at runtime by `devtoolsPlugin.ts`.

## Edge Cases

### `happy-dom` in tests
`happy-dom` supports `attachShadow`. No additional test environment configuration needed.

### `?inline` CSS import in Vitest
The `?inline` query returns the CSS string. In unit tests, mock it:
```ts
vi.mock("../style.css?inline", () => ({ default: "" }));
```

### `position: fixed` inside shadow root
Positioned elements inside shadow DOM still use the viewport as their containing block. The launcher pill and panel with `position: fixed` continue to work correctly.

### `<Teleport to="body">` in NetworkTab
The settings backdrop teleports to `document.body` (outside shadow root). This is acceptable — the backdrop uses only inline styles (`position:fixed;inset:0;z-index:99`) so consumer CSS does not affect it functionally.

## What Does NOT Change

- Public API: `createApi`, `useApi`, `DevtoolsBridge`, all exported types — unchanged
- All `.vue` components — unchanged
- Consumer usage: `app.use(createApi({ devtools: { enabled: true } }))` — unchanged
- Panel behavior, appearance, interactions — unchanged

## Browser Support

Shadow DOM v1 is supported in all modern browsers (Chrome 53+, Firefox 63+, Safari 10.1+). This covers the entire Vue 3 target audience.
