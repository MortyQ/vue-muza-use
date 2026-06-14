# Devtools UI Redesign — Design Spec

**Date:** 2026-06-14
**Scope:** UI/UX only — no functional changes to the bridge or data layer
**Phase:** This spec covers the launcher button, panel wrapper, and Network tab

---

## 1. Design Language

- **Color system:** oklch tokens from `libs/config/src/tailwind/theme.css`, dark theme
- **Brand color:** purple `oklch(65% 0.25 280)` — unique to vue-muza
- **Active/success states:** Vue green `oklch(63% 0.17 145)` — ecosystem recognition
- **Icons:** `VIcon` component from `libs/ui/src/components/base/VIcon.vue` with Lucide icons (`lucide:*`)
- **Style isolation:** Tailwind with `vmd` prefix to avoid host app conflicts

---

## 2. Launcher Button

A fixed pill in the bottom-right corner of the viewport.

**Visual:**
- Pill shape with the M icon on the left + "vue-muza" text
- Background: `--primary` purple with subtle glow
- Positioning: `fixed`, `bottom: 20px`, `right: 20px`, `z-index: 99999`

**M Icon (SVG, viewBox `0 0 80 36`):**
Two inverted Vue V signs (∧∧), two-tone, joined at the valley point `(40, 36)`:
```svg
<!-- LEFT ∧ outer -->  <path d="M0,36 L20,0 L40,36 Z"  fill="rgba(255,255,255,0.62)"/>
<!-- LEFT ∧ inner -->  <path d="M8,36 L20,16 L32,36 Z"  fill="white"/>
<!-- RIGHT ∧ outer --> <path d="M40,36 L60,0 L80,36 Z"  fill="rgba(255,255,255,0.62)"/>
<!-- RIGHT ∧ inner --> <path d="M48,36 L60,16 L72,36 Z"  fill="white"/>
```

---

## 3. Panel Wrapper

A bottom drawer that slides up from the bottom of the viewport, similar to Nuxt DevTools.

**Layout:**
- Fixed to bottom, full width, configurable height (default ~360px, resizable via top drag handle)
- `z-index: 99998` (below launcher button)
- Dark background: `--surface-sunken`
- Top border: 1px `--border`
- Border-radius on top corners: `12px`

**Tab bar (top of panel):**
- Tabs rendered horizontally at the top: Network · Instances · Timeline (+ future tabs)
- Active tab: Vue green indicator underline
- Tab icons via `VIcon` (Lucide): `lucide:wifi` / `lucide:layers` / `lucide:gantt-chart`

---

## 4. Network Tab

### 4.1 Layout

Three-zone horizontal layout:

```
┌──────────────────────────────────────────────────────┐
│ NetworkToolbar  (filter input + selects + record)    │
├──────────────────────────────────────────────────────┤
│ NetworkFilterBar  (All / 2xx / 3xx / 4xx / 5xx / …) │
├────────────────────┬───┬─────────────────────────────┤
│                    │ ↔ │                             │
│   RequestList      │   │   RequestDetail             │
│                    │   │                             │
└────────────────────┴───┴─────────────────────────────┘
```

- **Left/right split** is drag-resizable via a handle between `RequestList` and `RequestDetail`
- Min width: `RequestList` 180px, `RequestDetail` 200px

### 4.2 NetworkToolbar

- URL filter input (flex: 1)
- Method select dropdown
- Instance select dropdown
- Recording toggle button (red dot when active)
- Clear button

### 4.3 NetworkFilterBar

Pill buttons: **All · 2xx · 3xx · 4xx · 5xx · Pending**
- Active pill: `--primary-subtle` background, `--primary` text, `--primary` border
- Request count shown at the right end

### 4.4 RequestList

- Virtualized list (`@tanstack/vue-virtual`) for performance
- Nuxt-style rows: left colored accent bar + body with two rows
- Selected row: `--surface-raised` background + 2px right border in `--primary`
- Text truncates (no wrap) when panel is narrow

**RequestRow anatomy:**
```
[accent] [METHOD] /url/path          [feature badges…]
         [status] [duration]         [time] [size]
```

**Left accent bar colors by status:**
- 2xx → Vue green
- 3xx → info blue
- 4xx → warning amber
- 5xx → danger red
- Pending → muted gray

**Method badge colors:**
- GET → info blue
- POST → green
- PUT → warning amber
- PATCH → cyan
- DELETE → danger red

**Feature badges** (shown after URL, truncated if no space):

| Badge | Color | Shown when |
|---|---|---|
| `cache · <id>` | info blue | `cache` option set; ID embedded inline |
| `swr` | teal | `staleWhileRevalidate: true` |
| `polling` | purple (primary) | `interval` option set |
| `retry` | amber | `retry` option set |
| `batch` | violet | `useApiBatch` request |
| `debounce` | warm amber | `debounce` option set |
| `lazy` | muted gray | `immediate: false` |

Cache ID is embedded directly in the cache badge: `cache · users-list` — so related requests sharing one cache key are immediately recognizable in the list.

### 4.5 RequestDetail

#### Header
- Status chip (colored by status class) + method label + URL (truncated) + meta (duration · size · time) + close button

#### Tab bar
Tabs: **Split · Payload · Response · Headers**
- Default active tab: **Split**
- Active tab: `--primary` underline

#### Split mode (default)

Two panes side by side with a drag-resizable handle between them:

```
┌─────────────────────┬───┬──────────────────────┐
│ PAYLOAD         KV  │ ↔ │ RESPONSE          KV │
│ Copy                │   │ Copy                 │
├─────────────────────┤   ├──────────────────────┤
│ {                   │   │ {                    │
│   "key": "value"    │   │   "ok": true,        │
│   …                 │   │   "data": […]        │
│ }                   │   │ }                    │
└─────────────────────┴───┴──────────────────────┘
```

- Min width per pane: 120px
- Each pane scrolls independently (vertical + horizontal)
- Text never wraps — truncated with horizontal scroll instead

#### DataPane (reusable, used for Payload and Response panes)

Props: `title`, `data` (raw JSON), `copyable`

- **Header:** title (uppercase, muted) + KV toggle button + Copy button
- **Body:** toggles between `JsonViewer` and `KvViewer`
- KV button highlights in `--primary` when active

#### JsonViewer

Syntax-highlighted JSON display:
- Keys: blue `oklch(72% 0.17 260)`
- Strings: green `oklch(72% 0.17 145)`
- Numbers: amber `oklch(74% 0.18 55)`
- Booleans: red-orange `oklch(72% 0.18 25)`
- Null: muted
- `white-space: nowrap` — no wrapping, horizontal scroll on overflow

#### KvViewer

Flat key-value table:
- Key column (38% width, monospace, secondary color) — truncated
- Value column (remaining, monospace) — truncated, colored by type
- Nested objects/arrays shown as clickable badge: `Object {3} ▾` / `Array[5] ▾`
- Row hover: `--surface` background

#### Headers tab

Two sections: Request Headers / Response Headers, each as a flat key/value list (same style as KvViewer).

---

## 5. Component Tree

```
NetworkTab.vue                  ← state: selectedRequest, filterStatus, listWidth
├── NetworkToolbar.vue          ← search, selects, record toggle, clear
├── NetworkFilterBar.vue        ← status pills, request count
├── RequestList.vue             ← virtualized list, emits select
│   └── RequestRow.vue          ← accent + method + url + feature badges + meta
└── RequestDetail.vue           ← receives selectedRequest, manages detail tab
    ├── DetailHeader.vue        ← status + method + url + meta + close
    ├── DetailTabs.vue          ← Split / Payload / Response / Headers
    └── DetailContent.vue       ← renders view by activeTab
        ├── SplitView.vue       ← two DataPane + drag handle between them
        │   └── DataPane.vue    ← pane header (title + KV + copy) + body
        │       ├── JsonViewer.vue
        │       └── KvViewer.vue
        └── HeadersView.vue     ← request + response headers sections
```

**Key design decisions:**
- `DataPane` is reusable — used twice in `SplitView`, also standalone in Payload/Response single-tab modes
- `SplitView` owns only layout and drag state — no data logic
- `RequestDetail` does not know about the left drag handle — that belongs to `NetworkTab`
- `DetailContent` is a pure switch on `activeTab` — no extra state

---

## 6. Out of Scope (deferred)

- **Cache tab** — real-time cache status (hit/miss/stale/cleared), cache key browser
- **Instances tab** — per-instance composable state viewer
- **Timeline tab** — request waterfall chart
- Functional bridge changes (data layer untouched in this spec)
