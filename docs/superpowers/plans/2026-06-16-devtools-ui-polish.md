# Devtools UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 11 targeted CSS/template changes across the devtools panel to improve interaction polish, visual hierarchy, and design consistency.

**Architecture:** All changes are scoped to `packages/devtools/src/`. No logic, no types, no composables touched. Each task is isolated to one or two files and produces a shippable commit. No unit tests — verification is visual via the playground.

**Tech Stack:** Vue 3 `<Transition>` / `<TransitionGroup>`, CSS custom properties (oklch), `@iconify/vue`, `@tanstack/vue-virtual` (read-only — not modified)

---

## Pre-flight

Before starting, confirm the playground runs:

```bash
cd packages/playground && pnpm dev
```

Open the URL in the browser. You should see the Vue Muza devtools launcher pill in the bottom-right corner.

---

## Spec notes — items already done or adjusted

- **V-2 (DetailTabs active color):** Already implemented — `DetailTabs.vue` already uses `var(--dt-primary)`. Skipped.
- **I-5 (RequestList TransitionGroup):** Skipped — `RequestList.vue` uses `@tanstack/vue-virtual` with absolute positioning per row. `<TransitionGroup>` would animate on every scroll event, not just new arrivals.
- **V-1 requires two files:** `.toolbar` in `NetworkTab.vue` uses `var(--dt-nav)`, not `var(--dt-surface)`. Must update both `style.css` and `NetworkTab.vue` together.

---

## Files Modified

| File | Tasks |
|------|-------|
| `packages/devtools/src/style.css` | V-1, a11y |
| `packages/devtools/src/features/panel/components/SidePanel.vue` | V-7, I-1, V-4 |
| `packages/devtools/src/features/panel/components/FloatingPanel.vue` | I-1, V-4 |
| `packages/devtools/src/features/panel/components/TabBar.vue` | V-3, I-1 |
| `packages/devtools/src/features/network/components/NetworkTab.vue` | V-1 (toolbar), I-1, I-2, I-3, I-6 |
| `packages/devtools/src/features/network/components/DetailHeader.vue` | I-1 |
| `packages/devtools/src/features/network/components/DetailTabs.vue` | I-4 |
| `packages/devtools/src/shared/components/FeatureBadges.vue` | V-5 |
| `packages/devtools/src/shared/components/TreeNode.vue` | V-6 |

---

## Task 1: V-1 — Surface hierarchy

**Files:**
- Modify: `packages/devtools/src/style.css`
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

`--dt-nav` and `--dt-surface` are currently identical (`oklch(19% 0.023 250)`). Darkening `--dt-nav` creates a visible brightness ramp: tab-bar (darkest) → toolbar → content. The toolbar in `NetworkTab.vue` uses `var(--dt-nav)` and must be switched to `var(--dt-surface)` so it stays at the middle level.

- [ ] **Step 1: Update `--dt-nav` in style.css**

In `packages/devtools/src/style.css`, find and replace:

```css
/* before */
--dt-nav: oklch(19% 0.023 250);

/* after */
--dt-nav: oklch(16% 0.024 250);
```

- [ ] **Step 2: Update toolbar background in NetworkTab.vue**

In `packages/devtools/src/features/network/components/NetworkTab.vue`, find the `.toolbar` rule and change its background:

```css
/* before */
.toolbar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--dt-nav); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }

/* after — background changes to --dt-surface */
.toolbar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--dt-surface); border-bottom: 1px solid var(--dt-border-subtle); flex-shrink: 0; overflow-x: auto; scrollbar-width: none; }
```

- [ ] **Step 3: Verify visually**

Open playground. The devtools tab-bar should now be noticeably darker than the toolbar row below it. The filter-bar (which uses `var(--dt-surface)`) and the toolbar should look like the same level, while the tab-bar is a step darker.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/style.css packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "feat(devtools): darken nav surface for clear visual hierarchy"
```

---

## Task 2: V-7 — Side panel floating style

**Files:**
- Modify: `packages/devtools/src/features/panel/components/SidePanel.vue`

Makes the side panel consistent with the bottom panel: `top/right/bottom: 10px`, `border-radius: 14px`, deeper shadow.

- [ ] **Step 1: Update `.side-panel` styles**

In `packages/devtools/src/features/panel/components/SidePanel.vue`, replace the `.side-panel` rule:

```css
/* before */
.side-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 99998;
    display: flex;
    flex-direction: row;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border-left: 1px solid var(--dt-border);
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: -4px 0 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* after */
.side-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 99998;
    display: flex;
    flex-direction: row;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 14px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: -8px 0 40px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.04);
}
```

- [ ] **Step 2: Verify visually**

Switch the devtools to side mode. Panel should float with rounded corners and a gap from all three edges of the viewport. The bottom panel mode should look consistent.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/panel/components/SidePanel.vue
git commit -m "feat(devtools): float side panel with border-radius and margin"
```

---

## Task 3: V-3 — Settings icon

**Files:**
- Modify: `packages/devtools/src/features/panel/components/TabBar.vue`

Replaces the non-standard vertical three-dots `⋮` with `lucide:settings-2` (Iconify is already a dependency).

- [ ] **Step 1: Replace the settings button content in the template**

In `packages/devtools/src/features/panel/components/TabBar.vue`, find the settings button and replace its content:

```html
<!-- before -->
<button class="settings-btn" title="Layout settings" @click="$emit('settings')">
    <span class="dots"><span /><span /><span /></span>
</button>

<!-- after -->
<button class="settings-btn" title="Layout settings" @click="$emit('settings')">
    <Icon icon="lucide:settings-2" width="14" height="14" />
</button>
```

- [ ] **Step 2: Remove the unused `.dots` CSS rules**

In the same file's `<style scoped>` block, delete these rules entirely:

```css
.dots {
    display: flex;
    flex-direction: column;
    gap: 2.5px;
    align-items: center;
}
.dots span {
    display: block;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
}
```

- [ ] **Step 3: Verify visually**

The settings button should now show a small gear icon. Clicking it should still open the settings dropdown.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/panel/components/TabBar.vue
git commit -m "feat(devtools): replace vertical dots with settings-2 icon in tab bar"
```

---

## Task 4: V-5 — Feature badge color clusters

**Files:**
- Modify: `packages/devtools/src/shared/components/FeatureBadges.vue`

Reduces 6 different badge hues to 3 semantic clusters: cyan (data strategy), amber (behavior modifiers), neutral purple (request shape).

- [ ] **Step 1: Replace all badge color rules**

In `packages/devtools/src/shared/components/FeatureBadges.vue`, find and replace the six `.badge--*` rules at the bottom of `<style scoped>`:

```css
/* before */
.badge--cache    { background: oklch(22% 0.06 220); color: oklch(66% 0.18 220); border-color: oklch(32% 0.08 220); }
.badge--swr      { background: oklch(22% 0.08 190); color: oklch(66% 0.20 190); border-color: oklch(32% 0.10 190); }
.badge--polling  { background: var(--dt-primary-subtle); color: var(--dt-primary); border-color: oklch(38% 0.14 280); }
.badge--retry    { background: var(--dt-warning-subtle); color: var(--dt-warning); border-color: oklch(34% 0.10 75); }
.badge--batch    { background: oklch(22% 0.06 300); color: oklch(68% 0.18 300); border-color: oklch(32% 0.09 300); }
.badge--debounce { background: oklch(22% 0.06 50);  color: oklch(70% 0.16 50);  border-color: oklch(32% 0.09 50); }
.badge--lazy     { background: oklch(20% 0.04 270); color: oklch(58% 0.08 270); border-color: oklch(30% 0.06 270); }

/* after — 3 hue clusters */
/* Data strategy — cyan */
.badge--cache { background: oklch(22% 0.07 200); color: oklch(68% 0.18 200); border-color: oklch(32% 0.10 200); }
.badge--swr   { background: oklch(22% 0.07 200); color: oklch(62% 0.16 200); border-color: oklch(32% 0.10 200); }

/* Behavior modifiers — amber */
.badge--retry    { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }
.badge--debounce { background: oklch(22% 0.07 65); color: oklch(68% 0.16 65); border-color: oklch(34% 0.10 65); }
.badge--polling  { background: oklch(22% 0.07 65); color: oklch(72% 0.17 65); border-color: oklch(34% 0.10 65); }

/* Request shape — neutral purple */
.badge--batch { background: oklch(20% 0.05 270); color: oklch(62% 0.10 270); border-color: oklch(30% 0.07 270); }
.badge--lazy  { background: oklch(20% 0.04 270); color: oklch(55% 0.08 270); border-color: oklch(28% 0.06 270); }
```

- [ ] **Step 2: Verify visually**

Open a request that has multiple feature badges (e.g., cache + retry + polling). The badges should look like a cohesive group rather than a rainbow.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/shared/components/FeatureBadges.vue
git commit -m "feat(devtools): consolidate feature badge colors into 3 semantic clusters"
```

---

## Task 5: V-6 — TreeNode CSS-only chevron

**Files:**
- Modify: `packages/devtools/src/shared/components/TreeNode.vue`

Replaces Unicode `▶`/`▼` with a CSS `::before` chevron that rotates on expand. Zero additional DOM nodes, GPU-composited animation.

- [ ] **Step 1: Update the template**

In `packages/devtools/src/shared/components/TreeNode.vue`, replace the `tree-arrow` span:

```html
<!-- before -->
<span
    class="tree-arrow"
    :style="{ visibility: isExpandable ? 'visible' : 'hidden' }"
    @click="toggle"
>{{ expanded ? "▼" : "▶" }}</span>

<!-- after — no text content, arrow is CSS ::before -->
<span
    class="tree-arrow"
    :class="{ 'tree-arrow--open': expanded }"
    :style="{ visibility: isExpandable ? 'visible' : 'hidden' }"
    @click="toggle"
/>
```

- [ ] **Step 2: Update the CSS**

In the same file's `<style scoped>` block, replace the `.tree-arrow` rule:

```css
/* before */
.tree-arrow {
    width: 14px;
    flex-shrink: 0;
    color: var(--dt-foreground-subtle, #6b7280);
    font-size: 8px;
    cursor: pointer;
    user-select: none;
}
.tree-arrow:hover { color: var(--dt-primary, #a78bfa); }

/* after */
.tree-arrow {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--dt-foreground-subtle, #6b7280);
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
}
.tree-arrow:hover { color: var(--dt-primary, #a78bfa); }
.tree-arrow::before {
    content: '';
    display: block;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
    margin-top: -2px;
}
.tree-arrow--open::before {
    transform: rotate(45deg);
}
```

- [ ] **Step 3: Verify visually**

Open a request, go to the Response or Payload tab, expand a nested object. The chevron should smoothly rotate from pointing right (collapsed) to pointing down (expanded).

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/components/TreeNode.vue
git commit -m "feat(devtools): replace unicode arrows with CSS-only chevron in TreeNode"
```

---

## Task 6: I-1 — `:active` states on all pressable elements

**Files:**
- Modify: `packages/devtools/src/features/panel/components/TabBar.vue`
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue`
- Modify: `packages/devtools/src/features/panel/components/SidePanel.vue`
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`
- Modify: `packages/devtools/src/features/network/components/DetailHeader.vue`

Add `transform: scale(0.97)` on `:active` to every pressable element. Also update existing `transition` declarations to include `transform` and use `ease-out`.

- [ ] **Step 1: TabBar.vue — tab-btn, mode-btn, settings-btn, close-btn**

```css
/* tab-btn: add transform to existing transition, add :active */
.tab-btn {
    /* ... existing rules ... */
    transition: color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
}
.tab-btn:active { transform: scale(0.97); }

/* mode-btn: update transition, add :active */
.mode-btn {
    /* ... existing rules ... */
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.mode-btn:active { transform: scale(0.97); }

/* settings-btn: update transition, add :active */
.settings-btn {
    /* ... existing rules ... */
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.settings-btn:active { transform: scale(0.97); }

/* close-btn: add transition and :active */
.close-btn {
    /* ... existing rules ... */
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.close-btn:active { transform: scale(0.97); }
```

- [ ] **Step 2: FloatingPanel.vue — launcher-pill**

```css
/* add :active to existing launcher-pill */
.launcher-pill {
    /* existing: transition: transform 0.15s, box-shadow 0.15s; */
    transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
```

- [ ] **Step 3: SidePanel.vue — launcher-pill (identical to FloatingPanel)**

```css
.launcher-pill {
    transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.launcher-pill:active {
    transform: scale(0.96);
    box-shadow: 0 1px 6px oklch(65% 0.25 280 / 0.25);
}
```

- [ ] **Step 4: NetworkTab.vue — toolbar-btn, settings-item**

```css
.toolbar-btn {
    /* ... existing rules ... */
    transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
}
.toolbar-btn:active { transform: scale(0.97); }

.settings-item {
    /* ... existing rules ... */
    transition: background 120ms ease-out, transform 120ms ease-out;
}
.settings-item:active { transform: scale(0.97); }
```

- [ ] **Step 5: DetailHeader.vue — close-btn**

```css
.close-btn {
    /* ... existing rules ... */
    transition: background 120ms ease-out, color 120ms ease-out, transform 120ms ease-out;
}
.close-btn:active { transform: scale(0.97); }
```

- [ ] **Step 6: Verify visually**

Click every button type in the devtools. Each should visibly compress slightly on press and spring back on release.

- [ ] **Step 7: Commit**

```bash
git add \
  packages/devtools/src/features/panel/components/TabBar.vue \
  packages/devtools/src/features/panel/components/FloatingPanel.vue \
  packages/devtools/src/features/panel/components/SidePanel.vue \
  packages/devtools/src/features/network/components/NetworkTab.vue \
  packages/devtools/src/features/network/components/DetailHeader.vue
git commit -m "feat(devtools): add :active scale feedback to all pressable elements"
```

---

## Task 7: I-2 + I-3 + I-6 — NetworkTab transitions

**Files:**
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

Three small additions to the same file: settings menu entry animation, filter-pill color transition, drag-handle hover transition.

- [ ] **Step 1: Wrap settings menu in `<Transition>`**

In the template, find the settings menu `v-if` block and wrap it:

```html
<!-- before -->
<div v-if="settingsOpen" class="settings-menu" @keydown.escape="closeSettings">
    ...
</div>

<!-- after -->
<Transition name="settings-menu">
    <div v-if="settingsOpen" class="settings-menu" @keydown.escape="closeSettings">
        ...
    </div>
</Transition>
```

- [ ] **Step 2: Add settings menu transition CSS**

First, find the existing `.settings-menu` rule in `<style scoped>` and add `transform-origin: top right` to it (do not create a new rule):

```css
/* add this one line to the existing .settings-menu block */
transform-origin: top right;
```

Then append the transition classes to `<style scoped>`:

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

- [ ] **Step 3: Add filter-pill transition**

Find `.filter-pill` in `<style scoped>` and add the `transition` property:

```css
.filter-pill {
    height: 24px;
    padding: 0 10px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    background: transparent;
    color: var(--dt-foreground-muted);
    text-transform: capitalize;
    transition: background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
}
```

- [ ] **Step 4: Add drag-handle transition**

Find `.drag-handle` in `<style scoped>` and add `transition`:

```css
.drag-handle {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--dt-border-subtle);
    transition: background 150ms ease-out;
}
```

- [ ] **Step 5: Verify visually**

- Click the three-dots / settings icon — the menu should scale in from the top-right and scale out quickly when dismissed.
- Click different filter pills — the active highlight should smoothly transition between them.
- Hover the drag divider between list and detail — the color change should be gradual, not instant.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "feat(devtools): add settings menu animation and pill/handle transitions"
```

---

## Task 8: I-4 — DetailTabs transition ease-out

**Files:**
- Modify: `packages/devtools/src/features/network/components/DetailTabs.vue`

The file already has `transition: color 0.15s, border-color 0.15s` but uses the default `ease` curve. Update to `ease-out` and add `:active` scale.

- [ ] **Step 1: Update `.tab-btn` transition and add `:active`**

In `packages/devtools/src/features/network/components/DetailTabs.vue`, update the `.tab-btn` rule:

```css
/* before */
.tab-btn {
    height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* after */
.tab-btn {
    height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.tab-btn:active { transform: scale(0.97); }
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/features/network/components/DetailTabs.vue
git commit -m "feat(devtools): update detail-tab transition to ease-out"
```

---

## Task 9: V-4 — Panel open/close animation

**Files:**
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue`
- Modify: `packages/devtools/src/features/panel/components/SidePanel.vue`

Wraps the panel `v-else` in `<Transition>` so it slides in/out rather than snapping.

- [ ] **Step 1: FloatingPanel.vue — wrap panel in `<Transition>`**

Change `v-else` to `v-if="isOpen"` and wrap in `<Transition name="panel">`:

```html
<!-- before -->
<div
    v-else
    data-vmd-panel
    class="devtools-panel"
    :style="{ height: `${height}px` }"
>

<!-- after -->
<Transition name="panel">
    <div
        v-if="isOpen"
        data-vmd-panel
        class="devtools-panel"
        :style="{ height: `${height}px` }"
    >
```

Close the `</Transition>` tag after the panel's closing `</div>`.

- [ ] **Step 2: FloatingPanel.vue — add panel transition CSS**

Add to `<style scoped>`:

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

- [ ] **Step 3: SidePanel.vue — wrap panel in `<Transition>`**

Same pattern — change `v-else` to `v-if="isOpen"` and wrap:

```html
<!-- before -->
<div
    v-else
    data-vmd-panel
    class="side-panel"
    :style="{ width: `${sideWidth}px` }"
>

<!-- after -->
<Transition name="panel">
    <div
        v-if="isOpen"
        data-vmd-panel
        class="side-panel"
        :style="{ width: `${sideWidth}px` }"
    >
```

Close the `</Transition>` tag after the panel's closing `</div>`.

- [ ] **Step 4: SidePanel.vue — add panel transition CSS**

Add to `<style scoped>`:

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

- [ ] **Step 5: Verify visually**

Click the launcher pill to open and close the panel in both bottom and side modes. The panel should slide in from the correct direction and fade out quickly on close.

- [ ] **Step 6: Commit**

```bash
git add \
  packages/devtools/src/features/panel/components/FloatingPanel.vue \
  packages/devtools/src/features/panel/components/SidePanel.vue
git commit -m "feat(devtools): animate panel open/close with slide and fade"
```

---

## Task 10: a11y — prefers-reduced-motion

**Files:**
- Modify: `packages/devtools/src/style.css`

Users who have enabled reduced motion in their OS should not see transform-based animations. Keep opacity transitions (they aid comprehension), remove movement.

- [ ] **Step 1: Add reduced-motion block to style.css**

Append to the end of `packages/devtools/src/style.css`:

```css
@media (prefers-reduced-motion: reduce) {
    #vue-muza-devtools-root .panel-enter-active,
    #vue-muza-devtools-root .panel-leave-active {
        transition: opacity 150ms ease-out;
    }
    #vue-muza-devtools-root .panel-enter-from,
    #vue-muza-devtools-root .panel-leave-to {
        transform: none;
        opacity: 0;
    }

    #vue-muza-devtools-root .settings-menu-enter-active,
    #vue-muza-devtools-root .settings-menu-leave-active {
        transition: opacity 100ms ease-out;
    }
    #vue-muza-devtools-root .settings-menu-enter-from,
    #vue-muza-devtools-root .settings-menu-leave-to {
        transform: none;
        opacity: 0;
    }

    #vue-muza-devtools-root .tree-arrow::before {
        transition: none;
    }
}
```

Note: Vue transition class names are not scoped — they work from global CSS as long as the parent selector (`#vue-muza-devtools-root`) provides enough specificity.

- [ ] **Step 2: Verify**

In Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. Open and close the panel — it should fade without sliding.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/style.css
git commit -m "feat(devtools): respect prefers-reduced-motion for panel and menu animations"
```

---

## Done — Final check

After all 10 tasks:

```bash
# Confirm all commits landed cleanly
git log --oneline -12
```

Run through the full devtools UI manually:
- [ ] Tab bar noticeably darker than toolbar
- [ ] Side panel floats with rounded corners
- [ ] Settings button shows gear icon; menu animates in/out
- [ ] Filter pills smooth-transition on click
- [ ] All buttons compress on press
- [ ] Detail-tab indicator transitions smoothly
- [ ] Feature badges use 3 cohesive color clusters
- [ ] TreeNode chevron rotates on expand/collapse
- [ ] Panel slides in on open, fades out on close
