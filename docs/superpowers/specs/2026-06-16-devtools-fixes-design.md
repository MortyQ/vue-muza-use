# Devtools Fixes — Design Spec

**Date:** 2026-06-16  
**Scope:** `packages/devtools/src`  
**Semver:** patch (bug fixes + additive storage key, no public API change)

---

## Overview

Three independent fixes to the devtools panel:

1. Persist the width of the drag handle between the request list and detail pane
2. Eliminate the layout flash when switching tabs while KV response format is selected
3. Fix feature badges (cache/retry/polling/lazy/…) disappearing after SPA navigation

---

## Fix 1 — Persist list-detail drag handle width

### Problem

`listWidth` in `NetworkTab.vue` is initialised to `320` on every mount. The user's drag preference is lost on page reload or panel close/reopen.

### Solution

Follow the existing `vmd:panel-side-width` pattern in `devtoolsStorage.ts`:

**`devtoolsStorage.ts`** — add two functions:

```ts
export async function loadListWidth(): Promise<number | undefined> {
    return db.get<number>("vmd:list-width");
}

export async function saveListWidth(value: number): Promise<void> {
    return db.set("vmd:list-width", value);
}
```

**`NetworkTab.vue`** — load on mount, save on drag end:

```ts
onMounted(async () => {
    const saved = await loadListWidth();
    if (saved !== undefined) listWidth.value = saved;
});

// inside onUp() at end of startListResize():
saveListWidth(listWidth.value);
```

No default change — 320px is used when no stored value exists.

---

## Fix 2 — Eliminate KV format flash on tab switch

### Problem

`DataPane.vue` and `PayloadPane.vue` both initialise their format ref with a hardcoded default (`"json"` / `"kv"`), then overwrite it asynchronously in `onMounted` from IndexedDB. When switching tabs the component remounts, briefly renders the default, and then jumps to the stored value — visible flicker.

### Solution

Move the format ref to **module scope** (same pattern as `_panelMode` in `useFloatingPanel.ts`). The async load runs once; all subsequent mounts read the already-resolved value synchronously.

**`DataPane.vue`** (module scope, outside `<script setup>`):

```ts
const _responseMode = ref<"json" | "kv">("json");
let _responseModeLoaded = false;
```

Inside setup:

```ts
const mode = _responseMode;
if (!_responseModeLoaded) {
    _responseModeLoaded = true;
    loadResponseFormat().then((v) => { _responseMode.value = v; });
}
const toggleMode = () => {
    mode.value = mode.value === "json" ? "kv" : "json";
    saveResponseFormat(mode.value);
};
```

**`PayloadPane.vue`** — same pattern with `_payloadMode` / `_payloadModeLoaded` and `loadPayloadFormat` / `savePayloadFormat`.

Behaviour is unchanged for first load (still async); flicker only occurs on first open if the user's stored value differs from the default, which is acceptable. All subsequent tab switches are flash-free.

---

## Fix 3 — Feature badges survive SPA navigation

### Problem

`RequestList.vue` resolves instance options at render time:

```ts
// RequestList.vue:18
return instances.value.get(instanceId)?.options;
```

When the consumer SPA navigates to a new route, `useApi` composables from the previous page unmount → `onInstanceDestroyed` fires → `unregisterInstance()` removes the entry from `state.instances`. The live lookup then returns `undefined` and `FeatureBadges` disappears from all historical request rows.

### Solution

Snapshot `instanceOptions` into the `RequestRecord` at the moment the request is created. The record becomes self-contained; instance lifecycle no longer affects badge display.

**`types/index.ts`** — add field to `RequestRecord`:

```ts
export interface RequestRecord {
    // ... existing fields
    /** Snapshot of the instance's options taken when the request was created. */
    instanceOptions?: DevtoolsInstanceOptions;
}
```

**`devtoolsStore.ts`**, `addRequest()` — snapshot at creation:

```ts
const instanceOptions = record.instanceId
    ? state.instances.get(record.instanceId)?.options
    : undefined;

state.requests.push({
    ...record,
    id,
    instanceOptions,
    status: "pending",
    statusCode: null,
    response: null,
    error: null,
    duration: null,
});
```

**`RequestList.vue`** — remove `getInstanceOptions()`, read from record directly:

```ts
// remove getInstanceOptions function entirely
```

```html
:instance-options="requests[vRow.index].instanceOptions"
```

**`NetworkTab.vue`**, `selectedInstanceOptions` computed — read from record instead of live map:

```ts
const selectedInstanceOptions = computed<DevtoolsInstanceOptions | undefined>(() =>
    selectedRequest.value?.instanceOptions,
);
```

No changes required in `packages/use-api`.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/devtools/src/shared/storage/devtoolsStorage.ts` | Add `loadListWidth` / `saveListWidth` |
| `packages/devtools/src/features/network/components/NetworkTab.vue` | Load width on mount, save on drag end; simplify `selectedInstanceOptions` |
| `packages/devtools/src/features/network/components/RequestList.vue` | Remove `getInstanceOptions`, pass `request.instanceOptions` directly |
| `packages/devtools/src/shared/store/devtoolsStore.ts` | Snapshot `instanceOptions` in `addRequest()` |
| `packages/devtools/src/shared/types/index.ts` | Add `instanceOptions?` to `RequestRecord` |
| `packages/devtools/src/features/network/components/DataPane.vue` | Module-scope singleton for response format |
| `packages/devtools/src/features/network/components/PayloadPane.vue` | Module-scope singleton for payload format |

---

## Out of Scope

- Tests: devtools components are not covered by the existing Vitest suite (UI-only package); manual verification in playground is sufficient
- No changes to `packages/use-api`
- No new public API exports
