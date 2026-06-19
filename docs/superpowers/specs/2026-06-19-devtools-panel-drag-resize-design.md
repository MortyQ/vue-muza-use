# Devtools Panel — Drag & Multi-Edge Resize

**Date:** 2026-06-19
**Semver impact:** minor (new behavior, no breaking API changes)

---

## Overview

Add free-floating drag and multi-edge resize to both devtools panel modes (side, bottom). Each mode stores its own independent geometry (`x, y, width, height`) in IndexedDB. Panels appear at the saved position on reload without any flash or position jump.

---

## Goals

- Drag the panel to any position on screen via the logo pill in TabBar
- Resize the side panel from left, top, and bottom edges
- Resize the bottom panel from top, left, and right edges
- Each mode (side / bottom) remembers its own position and size independently
- Panel stays within viewport at all times
- No position flash on page reload
- One-click reset to default layout per mode via settings menu
- No impact on host page performance

---

## Non-Goals

- Corner (diagonal) resize handles — architecture is ready for it, deferred to a future iteration
- Generic `useDraggable` / `useResizable` primitives — YAGNI until a second consumer exists
- Snap-to-edge or magnetic docking behavior

---

## State Model

Each mode stores a single geometry object in IndexedDB:

| Key | Type | Default (side) | Default (bottom) |
|-----|------|---------------|-----------------|
| `vmd:panel-geometry-side` | `{x,y,width,height}` | right edge, full height, width 380px | — |
| `vmd:panel-geometry-bottom` | `{x,y,width,height}` | bottom edge, full width, height 360px | — |

Defaults are computed from `window.innerWidth / innerHeight` at first render so they are correct on any screen size.

**Removed keys:** `vmd:panel-height`, `vmd:panel-side-width`

Switching modes does not touch the other mode's geometry — each is fully independent.

---

## Architecture

### New: `composables/usePanelGeometry.ts`

Owns all geometry state for both modes. Takes `panelMode: Ref<PanelMode>` — switches the active geometry automatically via `computed` when mode changes.

```ts
interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface UsePanelGeometryReturn {
    geometry: Ref<PanelGeometry>;        // active mode's geometry
    isGeometryReady: Ref<boolean>;       // false until loaded from IndexedDB
    startDrag: (e: MouseEvent) => void;            // logo pill mousedown
    startResizeTop: (e: MouseEvent) => void;       // side: top edge
    startResizeBottom: (e: MouseEvent) => void;    // side: bottom edge
    startResizeLeft: (e: MouseEvent) => void;      // side: left edge / bottom: left edge
    startResizeRight: (e: MouseEvent) => void;     // bottom: right edge
    resetGeometry: () => void;                     // reset active mode to default, save to IndexedDB
}
```

**Initialization:** on mount, loads both modes' geometry from IndexedDB in parallel, sets `isGeometryReady = true`. Panel is hidden (`opacity: 0`) until ready — prevents position flash. No CSS transition on `opacity` during initialization (instant reveal, no fade-in on every page load).

**Drag:** on `mousedown` on logo pill, captures `startX/startY` and `startGeometry`. `mousemove` on `window` updates `geometry.value.x/y` clamped to viewport. `mouseup` saves to IndexedDB and removes listeners.

**Resize:** each handler captures the relevant start values. `mousemove` updates the appropriate geometry fields while enforcing min size and viewport boundaries. All handlers use `requestAnimationFrame` to cap updates at one per frame.

**Constraints:**
- Min width: 280px (side), 400px (bottom)
- Min height: 200px (side), 200px (bottom)
- Max: viewport boundary — panel cannot go outside `window.innerWidth / innerHeight`
- During drag: at least the full TabBar height (38px) must remain within viewport so the panel is always reachable

**Cleanup:** `onScopeDispose` removes any active `mousemove/mouseup` listeners.

---

### Modified: `useFloatingPanel.ts`

Becomes a thin orchestrator. Delegates all geometry to `usePanelGeometry`.

**Removed:** `height`, `sideWidth` refs; `startResizeHeight`, `startResizeSideWidth` functions; `MIN_HEIGHT`, `MAX_HEIGHT_RATIO`, `MIN_SIDE_WIDTH`, `MAX_SIDE_WIDTH_RATIO` constants.

**Added:** calls `usePanelGeometry(panelMode)` and spreads its return into `UseFloatingPanelReturn`.

```ts
interface UseFloatingPanelReturn {
    // unchanged
    isOpen: Ref<boolean>;
    panelMode: Ref<PanelMode>;
    toggle: () => void;
    close: () => void;
    switchMode: (mode: PanelMode) => void;
    // new (from usePanelGeometry)
    geometry: Ref<PanelGeometry>;
    isGeometryReady: Ref<boolean>;
    startDrag: (e: MouseEvent) => void;
    startResizeTop: (e: MouseEvent) => void;
    startResizeBottom: (e: MouseEvent) => void;
    startResizeLeft: (e: MouseEvent) => void;
    startResizeRight: (e: MouseEvent) => void;
    resetGeometry: () => void;
}
```

Components continue to call only `useFloatingPanel()` — no component changes their composable import.

---

### Modified: `devtoolsStorage.ts`

**Removed functions:** `loadPanelHeight`, `savePanelHeight`, `loadPanelSideWidth`, `savePanelSideWidth`

**Added functions:**
```ts
loadPanelGeometry(mode: PanelMode): Promise<PanelGeometry>
savePanelGeometry(mode: PanelMode, geometry: PanelGeometry): Promise<void>
```

**Added keys to KEYS const:**
```ts
geometrySide: "vmd:panel-geometry-side",
geometryBottom: "vmd:panel-geometry-bottom",
```

---

### Modified: `SidePanel.vue`

CSS positioning changes from fixed inset offsets to explicit coordinates from `geometry`:

```html
<div
  :style="{
    position: 'fixed',
    left: `${geometry.x}px`,
    top: `${geometry.y}px`,
    width: `${geometry.width}px`,
    height: `${geometry.height}px`,
    opacity: isGeometryReady ? 1 : 0,
    zIndex: 99998,
  }"
>
  <div class="resize-handle resize-left"   @mousedown.prevent="startResizeLeft" />
  <div class="resize-handle resize-top"    @mousedown.prevent="startResizeTop" />
  <div class="resize-handle resize-bottom" @mousedown.prevent="startResizeBottom" />
  ...
</div>
```

Existing single resize handle (`resize-handle` on left) is replaced by three handles.

---

### Modified: `FloatingPanel.vue`

Same positioning approach as SidePanel. Three resize handles:

```html
<div class="resize-handle resize-top"   @mousedown.prevent="startResizeTop" />
<div class="resize-handle resize-left"  @mousedown.prevent="startResizeLeft" />
<div class="resize-handle resize-right" @mousedown.prevent="startResizeRight" />
```

Existing single resize handle (`resize-handle` on top) is replaced by three handles.

---

### Modified: `TabBar.vue`

Logo pill becomes the drag handle. Hover swaps the logo icon for a drag icon:

```html
<div class="logo-pill" @mousedown.prevent="startDrag">
  <span class="logo-icon">▲▲</span>
  <span class="logo-drag-icon">⠿</span>
  vue-muza
</div>
```

```css
.logo-drag-icon { display: none; }
.logo-pill:hover .logo-icon      { display: none; }
.logo-pill:hover .logo-drag-icon { display: block; }
.logo-pill         { cursor: default; }
.logo-pill:hover   { cursor: grab; }
.logo-pill:active  { cursor: grabbing; }
```

---

### Modified: `NetworkTab.vue` (settings menu)

Add "Reset layout" item below a divider, below existing checkboxes:

```
☐  Toolbar
☑  Filter bar
───────────────
↺  Reset layout
```

Calls `resetGeometry()` from `useFloatingPanel`. Resets the current mode only.

---

## `PanelGeometry` type

Added to `packages/devtools/src/shared/types/index.ts`:

```ts
export interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
```

---

## Performance

- `mousemove` handlers wrapped in `requestAnimationFrame` — at most one DOM update per frame (~16ms)
- Style applied via `:style` binding on a single element — no layout cascade, no Vue component re-render tree
- Geometry loading is parallel for both modes (`Promise.all`) on init
- No `watch` or `computed` triggered during drag — only `geometry.value` ref is mutated

---

## Resize Handle UX

| Mode | Handle | Effect |
|------|--------|--------|
| side | left | width ← (also shifts x) |
| side | top | height ↑ (also shifts y) |
| side | bottom | height ↓ |
| bottom | top | height ↑ (also shifts y) |
| bottom | left | width ← (also shifts x) |
| bottom | right | width → |

Adding corner handles in the future: one additional `mousedown` handler per corner that combines two axis resize functions — no architectural change needed.

---

## Files Changed

| File | Change |
|------|--------|
| `shared/types/index.ts` | add `PanelGeometry` interface |
| `shared/storage/devtoolsStorage.ts` | remove old height/width keys+fns, add geometry keys+fns |
| `composables/usePanelGeometry.ts` | **new** — all geometry logic |
| `composables/useFloatingPanel.ts` | remove resize state, compose usePanelGeometry |
| `components/SidePanel.vue` | geometry-based positioning, 3 resize handles |
| `components/FloatingPanel.vue` | geometry-based positioning, 3 resize handles |
| `components/TabBar.vue` | logo pill drag handle + hover icon swap |
| `features/network/components/NetworkTab.vue` | "Reset layout" item in settings menu |
