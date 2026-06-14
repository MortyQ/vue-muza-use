# Devtools Panel Visual Redesign v2 — Implementation Spec

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the current full-width black drawer with a floating card panel and a new cool-slate color palette derived from `#2c3040`.

**Architecture:** Two surgical changes — new CSS tokens in `style.css`, and new shape styles in `FloatingPanel.vue`. Every other component inherits tokens automatically. No logic changes.

**Scope:** UI only. No bridge, no data, no tab content changes.

---

## Design Decisions

### Shape — Floating Card C2

The panel is no longer glued to the viewport edges. It floats above the bottom of the screen:

- `left: 12px`, `right: 12px` — 12px gap on both sides
- `bottom: 8px` — 8px gap from the bottom edge
- `border-radius: 12px` — fully rounded on all four corners (was: 10px top-only)
- `box-shadow: 0 -4px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)` — lifts panel off page
- The resize handle stays at the top inside the card

The launcher pill remains unchanged.

### Color Palette — `#2c3040` cool slate base

All `--dt-*` tokens are replaced. Hue is ~228° (cool blue-slate), no purple tint in backgrounds. Purple stays only in accent (`--dt-primary`). Vue green stays as active-tab accent.

| Token | Value | Usage |
|---|---|---|
| `--dt-background` | `oklch(22% 0.025 250)` | Panel main bg `#2c3040` |
| `--dt-surface-sunken` | `oklch(15% 0.022 250)` | Inputs, deep recessed areas |
| `--dt-surface` | `oklch(19% 0.023 250)` | Tab bar, nav bg |
| `--dt-surface-raised` | `oklch(26% 0.024 250)` | Toolbar, filter bar |
| `--dt-surface-active` | `oklch(29% 0.022 250)` | Hovered rows |
| `--dt-primary` | `oklch(65% 0.25 282)` | Purple accent — logo badge, active pills (unchanged) |
| `--dt-primary-subtle` | `oklch(24% 0.10 282)` | Polling/feature badge bg (unchanged) |
| `--dt-foreground` | `oklch(90% 0.014 250)` | Primary text |
| `--dt-foreground-secondary` | `oklch(65% 0.018 250)` | Secondary text |
| `--dt-foreground-muted` | `oklch(50% 0.018 250)` | Muted labels, timestamps |
| `--dt-foreground-subtle` | `oklch(38% 0.015 250)` | Placeholder text |
| `--dt-border-subtle` | `oklch(26% 0.020 250)` | Subtle dividers |
| `--dt-border` | `oklch(32% 0.022 250)` | Standard borders |
| `--dt-border-strong` | `oklch(42% 0.018 250)` | Focused/strong borders |
| `--dt-vue-green` | `oklch(78% 0.17 155)` | Active tab underline + text (unchanged) |
| `--dt-vue-green-subtle` | `oklch(24% 0.07 155)` | Cache badge bg (unchanged) |
| `--dt-nav` | `oklch(19% 0.023 250)` | Tab bar background (= surface) |
| `--dt-danger` | `oklch(63% 0.22 25)` | Error states (unchanged) |
| `--dt-danger-subtle` | `oklch(24% 0.08 25)` | Error badge bg (unchanged) |
| `--dt-warning` | `oklch(74% 0.17 75)` | Warning (unchanged) |
| `--dt-warning-subtle` | `oklch(24% 0.07 75)` | Warning bg (unchanged) |
| `--dt-info` | `oklch(66% 0.18 240)` | Info (unchanged) |
| `--dt-info-subtle` | `oklch(24% 0.07 240)` | Info bg (unchanged) |
| `--dt-success` | `oklch(78% 0.17 155)` | Success = vue green (unchanged) |
| `--dt-success-subtle` | `oklch(24% 0.07 155)` | Success bg (unchanged) |

---

## Files Changed

### `packages/devtools/src/style.css`
Replace all token values under `#vue-muza-devtools-root`. Only the values change — token names stay the same so nothing else breaks.

### `packages/devtools/src/features/panel/components/FloatingPanel.vue`
Change `.devtools-panel` CSS only:

```css
/* Before */
.devtools-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 12px 12px 0 0;
    border-top: 1px solid var(--dt-border);
}

/* After */
.devtools-panel {
    position: fixed;
    bottom: 8px;
    left: 12px;
    right: 12px;
    border-radius: 12px;
    border: 1px solid var(--dt-border);
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04);
}
```

The resize handle at the top stays unchanged — it becomes a drag zone inside the floating card.

---

## Files NOT Changed

- All tab content components (`NetworkTab.vue`, `InstancesTab.vue`, `TimelineTab.vue`, etc.)
- `RequestRow.vue`, `RequestList.vue`, `DetailHeader.vue`, etc.
- `TabBar.vue`, `LogoBadge.vue`, `MIcon.vue`
- `devtoolsPlugin.ts`, `devtoolsStore.ts`, bridge code
- All test files

---

## Testing

After implementation, visually verify in the playground (`packages/playground`):

1. Panel floats with visible gaps on sides and bottom — not glued to viewport edges
2. All four corners are rounded (including bottom)
3. Color feels cool slate — not blue-purple, not black
4. Text is readable at all hierarchy levels (foreground, muted, subtle)
5. Purple accent visible on logo badge and active filter pill
6. Vue green visible on active tab underline
7. Launcher pill appearance unchanged
