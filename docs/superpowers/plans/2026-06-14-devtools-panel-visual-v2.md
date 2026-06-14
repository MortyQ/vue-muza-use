# Devtools Panel Visual v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current full-width black panel with a floating card and a cool slate-blue color palette.

**Architecture:** Two files change — `style.css` gets new token values, `FloatingPanel.vue` gets new shape CSS. All other components pick up the new look automatically via the token cascade. Zero logic changes.

**Tech Stack:** Vue 3 SFCs, CSS custom properties (oklch), scoped styles.

---

## File Map

| File | Change |
|---|---|
| `packages/devtools/src/style.css` | Replace all token values inside `#vue-muza-devtools-root` |
| `packages/devtools/src/features/panel/components/FloatingPanel.vue` | Update `.devtools-panel` scoped CSS |

---

### Task 1: Replace color tokens in style.css

**Files:**
- Modify: `packages/devtools/src/style.css`

The current file uses hue 270 (purple-blue) for backgrounds. Replace every token value with the new cool slate palette (hue ~250). Token **names** must not change — only values.

- [ ] **Step 1: Open the file and verify current content**

Read `packages/devtools/src/style.css`. Confirm it starts with `@import "tailwindcss" prefix(vmd);` and has a `#vue-muza-devtools-root` block with `--dt-background` through `--dt-success-subtle`.

- [ ] **Step 2: Replace the entire token block**

Write the full replacement for `packages/devtools/src/style.css`:

```css
@import "tailwindcss" prefix(vmd);

#vue-muza-devtools-root {
  --dt-background:           oklch(22% 0.025 250);
  --dt-surface-sunken:       oklch(15% 0.022 250);
  --dt-surface:              oklch(19% 0.023 250);
  --dt-surface-raised:       oklch(26% 0.024 250);
  --dt-surface-active:       oklch(29% 0.022 250);
  --dt-primary:              oklch(65% 0.25 282);
  --dt-primary-subtle:       oklch(24% 0.10 282);
  --dt-foreground:           oklch(90% 0.014 250);
  --dt-foreground-secondary: oklch(65% 0.018 250);
  --dt-foreground-muted:     oklch(50% 0.018 250);
  --dt-foreground-subtle:    oklch(38% 0.015 250);
  --dt-border-subtle:        oklch(26% 0.020 250);
  --dt-border:               oklch(32% 0.022 250);
  --dt-border-strong:        oklch(42% 0.018 250);
  --dt-vue-green:            oklch(78% 0.17 155);
  --dt-vue-green-subtle:     oklch(24% 0.07 155);
  --dt-nav:                  oklch(19% 0.023 250);
  --dt-danger:               oklch(63% 0.22 25);
  --dt-danger-subtle:        oklch(24% 0.08 25);
  --dt-warning:              oklch(74% 0.17 75);
  --dt-warning-subtle:       oklch(24% 0.07 75);
  --dt-info:                 oklch(66% 0.18 240);
  --dt-info-subtle:          oklch(24% 0.07 240);
  --dt-success:              oklch(78% 0.17 155);
  --dt-success-subtle:       oklch(24% 0.07 155);
}
```

Key changes vs current:
- Background hue: 270 → 250 (less purple, more slate)
- `--dt-background`: 16% → 22% lightness (lighter, matches `#2c3040`)
- `--dt-surface-sunken`: 13% → 15%
- `--dt-surface` / `--dt-nav`: 20% → 19%
- `--dt-surface-raised`: 24% → 26%
- `--dt-surface-active`: 27% → 29%
- `--dt-primary-subtle`: hue 280 → 282, lightness 28% → 24%
- `--dt-foreground`: 93% → 90%, chroma 0.006 → 0.014 (slightly warmer white)
- `--dt-foreground-secondary`: 73% → 65%
- `--dt-foreground-muted`: 52% → 50%
- `--dt-foreground-subtle`: 40% → 38%
- `--dt-vue-green`: 63% → 78% (brighter, more readable on lighter bg)
- `--dt-success`: 63% → 78% (same as vue-green)

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/style.css
git commit -m "feat(devtools): update color tokens to cool slate palette (#2c3040 base)"
```

---

### Task 2: Update panel shape to floating card

**Files:**
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue` (the `<style scoped>` block, `.devtools-panel` rule only)

The panel currently sits flush against all three edges (`bottom: 0; left: 0; right: 0`) with only the top corners rounded. Change it to a floating card with gaps on all sides and full border-radius.

- [ ] **Step 1: Read the current file**

Read `packages/devtools/src/features/panel/components/FloatingPanel.vue` and locate the `.devtools-panel` rule inside `<style scoped>`. It currently looks like:

```css
.devtools-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99998;
    display: flex;
    flex-direction: column;
    background: var(--dt-surface-sunken);
    color: var(--dt-foreground);
    border-top: 1px solid var(--dt-border);
    border-radius: 12px 12px 0 0;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 2: Replace the `.devtools-panel` rule**

Using the Edit tool, replace the `.devtools-panel` rule with:

```css
.devtools-panel {
    position: fixed;
    bottom: 8px;
    left: 12px;
    right: 12px;
    z-index: 99998;
    display: flex;
    flex-direction: column;
    background: var(--dt-background);
    color: var(--dt-foreground);
    border: 1px solid var(--dt-border);
    border-radius: 12px;
    overflow: hidden;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04);
}
```

Changes made:
- `bottom: 0` → `bottom: 8px`
- `left: 0` → `left: 12px`
- `right: 0` → `right: 12px`
- `background: var(--dt-surface-sunken)` → `background: var(--dt-background)` (main bg, not sunken)
- `border-top: 1px solid var(--dt-border)` → `border: 1px solid var(--dt-border)` (all sides)
- `border-radius: 12px 12px 0 0` → `border-radius: 12px` (all corners)
- Added: `box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04)`

- [ ] **Step 3: Verify the launcher pill is untouched**

Confirm `.launcher-pill` rule still has `bottom: 20px; right: 20px; z-index: 99999` — it must not have changed.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/panel/components/FloatingPanel.vue
git commit -m "feat(devtools): floating card panel shape — 12px side/8px bottom margins, full border-radius"
```

---

### Task 3: Visual verification in playground

**Files:**
- No code changes — visual QA only.

- [ ] **Step 1: Start the playground dev server**

```bash
cd /path/to/useApi && pnpm --filter playground dev
```

Open the playground in a browser (typically `http://localhost:5173`).

- [ ] **Step 2: Open the devtools panel**

Click the purple `vue-muza` pill in the bottom-right corner. The panel should appear.

- [ ] **Step 3: Check the floating shape**

Verify all of the following:
- ✅ Panel has a visible gap on the left and right edges (~12px of page background visible)
- ✅ Panel has a visible gap at the bottom (~8px of page background visible)
- ✅ All four corners are rounded — including the bottom-left and bottom-right
- ✅ A subtle shadow is visible above and around the panel

- [ ] **Step 4: Check the colors**

Verify all of the following:
- ✅ Panel background is a medium cool slate-blue — clearly lighter than pure black, no obvious purple tint
- ✅ Tab bar background is slightly darker than the panel body
- ✅ Filter bar / toolbar is slightly lighter than the panel body
- ✅ Primary text (URL paths, labels) is near-white and readable
- ✅ Muted text (timestamps, tab names) is visibly dimmer but still readable
- ✅ The vue-muza logo badge is purple (oklch 65% 0.25 282)
- ✅ The active tab ("Network") has a Vue green (`oklch(78% 0.17 155)`) underline and text
- ✅ The "All" filter pill is purple when active

- [ ] **Step 5: Check the launcher pill**

Close the panel (click ✕). Verify:
- ✅ Launcher pill still appears bottom-right, purple, with M logo + "vue-muza" text
- ✅ Launcher pill appearance is completely unchanged

- [ ] **Step 6: Commit verification note**

No code changes in this task. If any visual issue is found in steps 3–5, go back to Task 1 or Task 2 and fix the specific token or CSS property before continuing.
