# Devtools: Payload Tree View & Query Params

**Date:** 2026-06-15
**Scope:** `packages/devtools/`

---

## Overview

Four improvements to the devtools network request viewer:

1. **Query params captured and displayed separately** — currently params are merged into `payload` and lost when a body exists.
2. **Collapsible tree viewer** — replaces flat `KvViewer` with an interactive tree (Chrome DevTools style).
3. **Default panel mode = `"side"`** — new users see the side panel by default instead of bottom.
4. **Persist payload format** — user's KV/JSON choice in the Payload pane is saved to IndexedDB.

---

## 1. Data Layer

### 1.1 `RequestRecord` — new field

**File:** `packages/devtools/src/shared/types/index.ts`

Add `queryParams` alongside `payload`:

```ts
export interface RequestRecord {
    // ...existing fields...
    payload: unknown;           // request body only (was: body OR params)
    queryParams: unknown;       // query params (new)
    // ...
}
```

### 1.2 `useApi.ts` — capture params separately

**File:** `packages/use-api/src/useApi.ts`

Current:
```ts
payload: resolvedData ?? resolvedParams ?? null,
```

New:
```ts
payload: resolvedData ?? null,
queryParams: resolvedParams ?? null,
```

### 1.3 `devtoolsStore.ts` — store queryParams

**File:** `packages/devtools/src/shared/store/devtoolsStore.ts`

`onRequestStart` receives and stores `queryParams`. Apply same truncation logic as `payload`.

---

## 2. Shared Components

### 2.1 `TreeNode.vue` (new)

**File:** `packages/devtools/src/shared/components/TreeNode.vue`

Recursive node component. Handles one key-value pair.

**Props:**
```ts
nodeKey: string | number | null   // key label (null for root)
value: unknown                     // the value to render
depth: number                      // indent level (0 = root)
```

**Local state:**
```ts
const expanded = ref(false)
```

**Rendering rules:**

| Value type | Render |
|---|---|
| `string` | green `"value"` |
| `number` | orange `123` |
| `boolean` | red `true` / `false` |
| `null` | grey `null` |
| `object` (non-null) | arrow + clickable badge `▶ Object {N}` |
| `array` | arrow + clickable badge `▶ Array [N]` |

When expanded, child entries render as `<TreeNode>` instances with `depth + 1`.

**Click targets for expand/collapse:** both the `▶`/`▼` arrow and the badge chip. Clicking either toggles `expanded`.

**Arrow visibility:** leaf nodes (primitives) render the arrow with `visibility: hidden` — preserves column alignment without showing a non-functional arrow.

**Array keys:** when iterating an array, `nodeKey` is the numeric index (`0`, `1`, `2`, …).

**Indent:** each depth level adds `14px` of left padding.

### 2.2 `TreeViewer.vue` (new)

**File:** `packages/devtools/src/shared/components/TreeViewer.vue`

Top-level wrapper. Iterates over top-level keys and renders `<TreeNode>` for each.

**Props:**
```ts
value: unknown   // the object/array to display
```

If `value` is `null` or not an object/array, renders an empty state.

### 2.3 `KvViewer.vue` — deprecated

`KvViewer.vue` is replaced by `TreeViewer.vue`. Remove it after migration.

---

## 3. Network Feature Components

### 3.1 `PayloadPane.vue` (new)

**File:** `packages/devtools/src/features/network/components/PayloadPane.vue`

Replaces the generic `DataPane` usage for the Payload pane. Owns two sections: **Query Params** and **Body**.

**Props:**
```ts
queryParams: unknown
payload: unknown
truncated: boolean
```

**Local state:**
```ts
const format = ref<"kv" | "json">("kv")
```

**On mount:** loads saved format from IndexedDB via `loadPayloadFormat()`. Updates `format.value`.

**On format toggle:** saves new value via `savePayloadFormat(format.value)`.

**Layout:**

```
┌─────────────────────────────────────────┐
│ PAYLOAD                    [KV] [JSON] [Copy] │
├─────────────────────────────────────────┤
│ Query Params                         3  │
│  ▶ q : "fasdfsdaf"                      │
│  ▶ page : 1                             │
├─────────────────────────────────────────┤
│ Body                                    │
│  No body                                │
└─────────────────────────────────────────┘
```

- **Query Params section:** shows count badge if params exist; "No params" if empty.
- **Body section:** shows "No body" if `payload` is null; renders `TreeViewer` (KV) or `JsonViewer` (JSON).
- KV/JSON toggle applies to both sections simultaneously.
- Copy button copies the body payload only (same as current DataPane behaviour).

### 3.2 `SplitView.vue` — update

**File:** `packages/devtools/src/features/network/components/SplitView.vue`

Replace `DataPane` (payload usage) with `<PayloadPane :queryParams="request.queryParams" :payload="request.payload" :truncated="request.truncated" />`.

### 3.3 `DataPane.vue` and `PayloadView.vue` — update

- `PayloadView.vue`: replace `<KvViewer>` with `<TreeViewer>`.
- `DataPane.vue` (Response pane): no structural change, but now uses `TreeViewer` indirectly through `PayloadView`.

---

## 4. Storage

### 4.1 New keys and functions

**File:** `packages/devtools/src/shared/storage/devtoolsStorage.ts`

```ts
// Keys
payloadFormat: "vmd:payload-format"

// Functions
loadPayloadFormat(): Promise<"kv" | "json">   // default: "kv"
savePayloadFormat(format: "kv" | "json"): void
```

### 4.2 Default panel mode

**File:** `packages/devtools/src/shared/storage/devtoolsStorage.ts`

`loadPanelMode()` default return value: `"side"` (was `"bottom"`).

**File:** `packages/devtools/src/features/panel/composables/useFloatingPanel.ts`

Initial ref default: `const _panelMode = ref<PanelMode>("side")` (was `"bottom"`).

---

## 5. Component Deletion

After migration, delete:

- `packages/devtools/src/features/network/components/KvViewer.vue`

---

## 6. File Change Summary

| File | Change |
|---|---|
| `shared/types/index.ts` | Add `queryParams: unknown` to `RequestRecord` |
| `use-api/src/useApi.ts` | Capture `queryParams` separately from `payload` |
| `shared/store/devtoolsStore.ts` | Store and truncate `queryParams` |
| `shared/storage/devtoolsStorage.ts` | Add `payloadFormat` key + load/save; change `loadPanelMode` default to `"side"` |
| `shared/components/TreeNode.vue` | New — recursive tree node |
| `shared/components/TreeViewer.vue` | New — top-level tree wrapper |
| `features/network/components/PayloadPane.vue` | New — two-section payload pane |
| `features/network/components/SplitView.vue` | Use `PayloadPane` instead of `DataPane` for payload |
| `features/network/components/PayloadView.vue` | Replace `KvViewer` with `TreeViewer` |
| `features/panel/composables/useFloatingPanel.ts` | Default mode `"side"` |
| `features/network/components/KvViewer.vue` | Delete |

---

## 7. Tests

| Test file | What to cover |
|---|---|
| `shared/components/TreeNode.test.ts` | Renders primitives, expands object, expands array, badge click, arrow click, deep nesting |
| `shared/components/TreeViewer.test.ts` | Null input, object input, array input, passes depth correctly |
| `features/network/components/PayloadPane.test.ts` | Shows query params section, shows body section, "No params" / "No body" states, format toggle saves to IDB, loads saved format on mount |
| `shared/storage/devtoolsStorage.test.ts` | `loadPayloadFormat` default `"kv"`, saves and loads correctly; `loadPanelMode` default `"side"` |
