# Devtools UI Polish — Design Spec

**Date:** 2026-06-16  
**Branch:** feature/devtools  
**Semver impact:** patch (visual/interaction only, no public API changes)

---

## Overview

A single-pass polish pass across the devtools panel UI. Covers two categories:

1. **Interaction polish** — 6 animation/transition fixes per Emil Kowalski's design engineering philosophy
2. **Visual consistency** — 7 UI decisions that improve surface hierarchy, icon affordances, component consistency, and the floating panel aesthetic

No new features. No behaviour changes. Pure feel.

---

## Category 1 — Interaction Polish

### I-1: `:active` states on all pressable elements

**Files:** `SidePanel.vue`, `FloatingPanel.vue`, `TabBar.vue`, `NetworkTab.vue`, `RequestDetail.vue`, `DetailTabs.vue`

Every button that currently has a `:hover` state needs a corresponding `:active`.

```css
/* Add to every .toolbar-btn, .filter-pill, .tab-btn, .mode-btn, .close-btn, .icon-btn, etc. */
.btn:active {
  transform: scale(0.97);
}

/* Wrapper transition — must be on the element, not just :active */
.btn {
  transition: transform 120ms ease-out, background 150ms ease-out, color 150ms ease-out;
}
```

The launcher pill in both panel components already has hover transform. Add:
```css
.launcher-pill:active {
  transform: scale(0.96);
  box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
```

Scale range: `0.96–0.97` for small buttons, `0.97–0.98` for larger ones (launcher pill).

---

### I-2: Settings menu entry animation

**File:** `NetworkTab.vue`

The settings menu appears via `v-if="settingsOpen"` with no transition. Wrap in a Vue `<Transition>` and animate entry/exit.

```css
.settings-menu-enter-active {
  transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease-out;
}
.settings-menu-leave-active {
  transition: transform 100ms ease-in, opacity 100ms ease-in;
}
.settings-menu-enter-from,
.settings-menu-leave-to {
  transform: scale(0.95) translateY(-4px);
  opacity: 0;
}
```

`transform-origin: top right` — menu opens from the trigger button (top-right corner of the panel). Asymmetric timing: enter 150ms, exit 100ms (exit faster).

---

### I-3: Filter-pill active transition

**File:** `NetworkTab.vue`

```css
/* Before: no transition on .filter-pill */
/* After: */
.filter-pill {
  transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out;
}
```

---

### I-4: Detail-tabs active indicator transition

**File:** `DetailTabs.vue` (and any tab component using `border-bottom` as active indicator)

```css
.detail-tab {
  transition: color 150ms ease-out, border-color 150ms ease-out;
}
```

The main `TabBar.vue` already has `transition: color 0.15s, border-color 0.15s` — verify it uses `ease-out` not the default `ease`.

---

### I-5: Request-row entry animation

**File:** `RequestList.vue`

New rows appear instantly. Add a subtle enter via Vue `<TransitionGroup>`:

```html
<TransitionGroup name="row">
  <RequestRow v-for="req in requests" :key="req.id" … />
</TransitionGroup>
```

```css
.row-enter-active {
  transition: opacity 150ms ease-out, transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}
.row-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
/* No leave animation — rows are cleared in bulk, not one-by-one */
```

No stagger needed (rows arrive one at a time in practice). No exit animation — "Clear log" clears everything at once; animating bulk removal would feel slow.

---

### I-6: Drag-handle hover transition

**File:** `NetworkTab.vue`

```css
/* Before: background changes instantly on hover */
.drag-handle {
  transition: background 150ms ease-out;
}
/* FloatingPanel and SidePanel resize-handle already have transition: background 0.15s — verify ease-out */
```

---

## Category 2 — Visual Consistency

### V-1: Surface hierarchy — nav darker than toolbar

**File:** `style.css`

Currently `--dt-nav` and `--dt-surface` are identical (`oklch(19% 0.023 250)`), making the tab bar and toolbar visually indistinguishable.

```css
/* Before */
--dt-nav: oklch(19% 0.023 250);
--dt-surface: oklch(19% 0.023 250);  /* identical */

/* After — three distinct levels */
--dt-nav: oklch(16% 0.024 250);      /* darkest — chrome/navigation */
--dt-surface: oklch(19% 0.023 250);  /* unchanged — toolbar row */
/* filter-bar uses --dt-background (22%) naturally — already one step lighter */
```

This creates a clear top-to-bottom brightness ramp: nav (16%) → toolbar (19%) → content (22%).

---

### V-2: DetailTabs active color → primary

**File:** `DetailTabs.vue` (and wherever sub-tabs render)

Vue Green stays as the active indicator in the main `TabBar` (Vue brand, intentional). Sub-tabs inside the detail pane switch to `--dt-primary` (purple) for semantic clarity: green = navigation landmark, purple = content selection.

```css
/* Before */
.detail-tab--active {
  color: var(--dt-vue-green);
  border-bottom-color: var(--dt-vue-green);
}

/* After */
.detail-tab--active {
  color: var(--dt-primary);
  border-bottom-color: var(--dt-primary);
}
```

---

### V-3: Settings button icon

**File:** `TabBar.vue`

Replace the vertical three-dots `⋮` (non-standard for a settings affordance) with a proper icon.

```html
<!-- Before: custom dots span -->
<span class="dots"><span /><span /><span /></span>

<!-- After: Iconify icon (already a dependency) -->
<Icon icon="lucide:settings-2" width="14" height="14" />
```

Remove `.dots` and `.dots span` CSS rules. Button dimensions and hover styles unchanged.

---

### V-4: Panel open/close animation

**Files:** `FloatingPanel.vue`, `SidePanel.vue`

Both panels appear/disappear via `v-else` with no transition.

**FloatingPanel** (bottom drawer):
```css
.panel-enter-active {
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out;
}
.panel-leave-active {
  transition: transform 160ms ease-in, opacity 160ms ease-in;
}
.panel-enter-from,
.panel-leave-to {
  transform: translateY(12px);
  opacity: 0;
}
```

**SidePanel** (right drawer):
```css
.panel-enter-active {
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out;
}
.panel-leave-active {
  transition: transform 160ms ease-in, opacity 160ms ease-in;
}
.panel-enter-from,
.panel-leave-to {
  transform: translateX(12px);
  opacity: 0;
}
```

Wrap the `v-else` block in `<Transition name="panel">` in each template.

---

### V-5: Feature badges — reduced hue count

**File:** `FeatureBadges.vue`

Currently 6 different hues for 7 badge types creates visual noise. Group into 3 semantic clusters:

| Cluster | Badges | Hue |
|---------|--------|-----|
| Data strategy | `cache`, `swr` | Cyan (200) |
| Behavior modifiers | `retry`, `debounce`, `polling` | Amber (65) |
| Request shape | `batch`, `lazy` | Neutral purple (270) |

```css
/* Data strategy — cyan */
.badge--cache { background: oklch(22% 0.07 200); color: oklch(68% 0.18 200); border-color: oklch(32% 0.10 200); }
.badge--swr   { background: oklch(22% 0.07 200); color: oklch(62% 0.16 200); border-color: oklch(32% 0.10 200); }

/* Behavior modifiers — amber */
.badge--retry    { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }
.badge--debounce { background: oklch(22% 0.07 65); color: oklch(68% 0.16 65); border-color: oklch(34% 0.10 65); }
.badge--polling  { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }

/* Request shape — neutral */
.badge--batch { background: oklch(20% 0.05 270); color: oklch(62% 0.10 270); border-color: oklch(30% 0.07 270); }
.badge--lazy  { background: oklch(20% 0.04 270); color: oklch(55% 0.08 270); border-color: oklch(28% 0.06 270); }
```

---

### V-6: TreeNode — SVG chevron with rotation

**File:** `TreeNode.vue`

Replace Unicode `▶`/`▼` with an SVG chevron that rotates on expand.

```html
<!-- Before -->
<span class="tree-arrow" @click="toggle">{{ expanded ? "▼" : "▶" }}</span>

<!-- After -->
<span class="tree-arrow" :class="{ 'tree-arrow--open': expanded }" @click="toggle">
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <path d="M2 3l2 2 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</span>
```

```css
.tree-arrow {
  transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
  transform: rotate(-90deg);  /* pointing right = collapsed */
}
.tree-arrow--open {
  transform: rotate(0deg);    /* pointing down = expanded */
}
```

---

### V-7: Side panel — floating style

**File:** `SidePanel.vue`

Make the side panel visually consistent with the bottom panel (which already floats with border-radius and margins).

```css
/* Before */
.side-panel {
  top: 0;
  right: 0;
  bottom: 0;
  border-left: 1px solid var(--dt-border);
  /* no border-radius */
  box-shadow: -4px 0 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* After */
.side-panel {
  top: 10px;
  right: 10px;
  bottom: 10px;
  border: 1px solid var(--dt-border);
  border-radius: 14px;
  box-shadow:
    -8px 0 40px oklch(0% 0 0 / 0.55),
    0 0 0 1px oklch(100% 0 0 / 0.04);
}
```

The `overflow: hidden` on `.side-panel` already clips child content to the border-radius — no changes needed to child components.

---

## Implementation Order

Execute in this order to avoid visual regressions mid-pass:

1. **V-1** — `style.css` surface hierarchy (affects all components visually, do first)
2. **V-7** — `SidePanel.vue` floating style (structural, isolated)
3. **V-3** — `TabBar.vue` settings icon (isolated)
4. **V-2** — `DetailTabs.vue` active color (isolated)
5. **V-5** — `FeatureBadges.vue` badge colors (isolated)
6. **V-6** — `TreeNode.vue` chevron + animation (isolated)
7. **I-1** — `:active` states across all button components (sweep)
8. **I-2** — Settings menu transition (`NetworkTab.vue`)
9. **I-3** — Filter-pill transition (`NetworkTab.vue`)
10. **I-4** — Detail-tab indicator transition
11. **I-5** — Request-row `<TransitionGroup>` (`RequestList.vue`)
12. **I-6** — Drag-handle hover transition (`NetworkTab.vue`)
13. **V-4** — Panel open/close `<Transition>` (both panel components, do last — most structural)

---

## What's Explicitly Out of Scope

- No changes to composable logic, types, or public API
- No changes to `dist/`
- No Tailwind → scoped CSS migration (FeatureBadges uses `@reference "tailwindcss"` — leave as-is, only change color values)
- No layout changes (widths, heights, split ratios)
- No new features (search, copy, export, etc.)

---

## Accessibility

All animated elements must respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  /* Remove transform/translate animations, keep opacity */
  .row-enter-active,
  .panel-enter-active,
  .panel-leave-active,
  .settings-menu-enter-active,
  .settings-menu-leave-active {
    transition: opacity 150ms ease-out;
  }
  .row-enter-from,
  .panel-enter-from,
  .panel-leave-to,
  .settings-menu-enter-from,
  .settings-menu-leave-to {
    transform: none;
    opacity: 0;
  }
  .tree-arrow {
    transition: none;
  }
}
```

Add this block to `style.css` (global scope) or co-locate in each component as appropriate.
