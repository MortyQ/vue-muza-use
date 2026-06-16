# Devtools Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three devtools bugs: persist list-detail drag handle width, eliminate KV format flash on tab switch, and prevent feature badges from disappearing after SPA navigation.

**Architecture:** Three independent patches all scoped to `packages/devtools/src`. Fix 1 adds a storage key. Fix 2 promotes a component-local `ref` to module scope so it survives remounts. Fix 3 snapshots instance options into `RequestRecord` at creation time so badges are not tied to the instance lifecycle.

**Tech Stack:** Vue 3 (SFCs with `<script setup>`), TypeScript strict, idb-keyval (IndexedDB wrapper), Vitest (no devtools unit tests — verify via build + playground).

---

## Files Changed

| File | Change |
|------|--------|
| `packages/devtools/src/shared/storage/devtoolsStorage.ts` | Add `listWidth` key + `loadListWidth` / `saveListWidth` |
| `packages/devtools/src/features/network/components/NetworkTab.vue` | Load width on mount, save on drag end; simplify `selectedInstanceOptions` |
| `packages/devtools/src/features/network/components/DataPane.vue` | Module-scope singleton for response format |
| `packages/devtools/src/features/network/components/PayloadPane.vue` | Module-scope singleton for payload format |
| `packages/devtools/src/shared/types/index.ts` | Add `instanceOptions?: DevtoolsInstanceOptions` to `RequestRecord` |
| `packages/devtools/src/shared/store/devtoolsStore.ts` | Snapshot `instanceOptions` in `addRequest()`; update parameter Omit |
| `packages/devtools/src/features/network/components/RequestList.vue` | Remove `getInstanceOptions`, pass `request.instanceOptions` directly |

---

## Task 1 — Persist list-detail drag handle width

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

- [ ] **Step 1: Add storage key and functions to devtoolsStorage.ts**

In the `KEYS` const object (line 4), add the new key after `splitPayloadWidth`:

```ts
splitPayloadWidth: "vmd:split-payload-width",
listWidth: "vmd:list-width",
```

At the end of the file (after `saveResponseFormat`, line 170), append:

```ts
/**
 * Loads the saved request list width from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadListWidth(): Promise<number | undefined> {
    return get<number>(KEYS.listWidth);
}

/**
 * Saves the request list width to IndexedDB.
 */
export async function saveListWidth(width: number): Promise<void> {
    return set(KEYS.listWidth, width);
}
```

- [ ] **Step 2: Update NetworkTab.vue — import, load on mount, save on drag end**

At the top of the `<script setup>` block, add `onMounted` to the Vue import and add the storage imports:

```ts
import { ref, computed, onMounted, onScopeDispose } from "vue";
```

Add to the storage import line (currently only `clearRequests` is imported from the store):

```ts
import { loadListWidth, saveListWidth } from "../../../shared/storage/devtoolsStorage";
```

After `const MIN_LIST_WIDTH = 180;` (line 44), add the mounted hook:

```ts
onMounted(async () => {
    const saved = await loadListWidth();
    if (saved !== undefined) listWidth.value = saved;
});
```

Inside `startListResize`, update `onUp` to save after drag:

```ts
function onUp(): void {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    dragCleanup = null;
    saveListWidth(listWidth.value);
}
```

- [ ] **Step 3: Build devtools to confirm no type errors**

```bash
pnpm --filter @ametie/vue-muza-devtools build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.ts \
        packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "fix(devtools): persist request list width to IndexedDB"
```

---

## Task 2 — Eliminate KV format flash on tab switch

**Files:**
- Modify: `packages/devtools/src/features/network/components/DataPane.vue`
- Modify: `packages/devtools/src/features/network/components/PayloadPane.vue`

The flash happens because each component remount starts with a hardcoded default (`"json"` / `"kv"`) and overwrites it asynchronously from IndexedDB. Moving the `ref` to module scope means the async load happens once; every remount reads the already-resolved value synchronously.

Vue SFCs support a regular `<script>` block (module scope, runs once per component definition) alongside `<script setup>` (setup scope, runs per instance). Variables declared in `<script>` are accessible in `<script setup>`.

- [ ] **Step 5: Update DataPane.vue**

Replace the entire `<script setup>` block with a `<script>` + `<script setup>` pair:

```vue
<script lang="ts">
import { ref } from "vue";
import { loadResponseFormat, saveResponseFormat } from "../../../shared/storage/devtoolsStorage";

// Module-level singleton — survives tab remounts, IndexedDB loaded only once
const _responseMode = ref<"json" | "kv">("json");
let _responseModeLoaded = false;
</script>

<script setup lang="ts">
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";

const props = defineProps<{
    title: string;
    data: unknown;
    truncated?: boolean;
}>();

const mode = _responseMode;

if (!_responseModeLoaded) {
    _responseModeLoaded = true;
    loadResponseFormat().then((v) => { _responseMode.value = v; });
}

async function toggleMode(): Promise<void> {
    mode.value = mode.value === "kv" ? "json" : "kv";
    await saveResponseFormat(mode.value);
}

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2));
    } catch {
        /* clipboard unavailable — no-op */
    }
}
</script>
```

The `<template>` and `<style>` blocks are unchanged.

- [ ] **Step 6: Update PayloadPane.vue**

Replace the `<script setup>` block with a `<script>` + `<script setup>` pair:

```vue
<script lang="ts">
import { ref } from "vue";
import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";
import type { PayloadFormat } from "../../../shared/types/index";

// Module-level singleton — survives tab remounts, IndexedDB loaded only once
const _payloadFormat = ref<PayloadFormat>("kv");
let _payloadFormatLoaded = false;
</script>

<script setup lang="ts">
import { computed } from "vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";

const props = defineProps<{
    queryParams: unknown;
    payload: unknown;
    truncated: boolean;
}>();

const format = _payloadFormat;

if (!_payloadFormatLoaded) {
    _payloadFormatLoaded = true;
    loadPayloadFormat().then((v) => { _payloadFormat.value = v; });
}

const queryParamKeys = computed((): string[] => {
    if (
        props.queryParams === null ||
        props.queryParams === undefined ||
        typeof props.queryParams !== "object"
    ) return [];
    return Object.keys(props.queryParams as object);
});

const hasQueryParams = computed(() => queryParamKeys.value.length > 0);
const queryParamCount = computed((): number => queryParamKeys.value.length);
const hasBody = computed(() => props.payload !== null && props.payload !== undefined);

async function toggleFormat(): Promise<void> {
    format.value = format.value === "kv" ? "json" : "kv";
    await savePayloadFormat(format.value);
}

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(JSON.stringify(props.payload, null, 2));
    } catch {
        /* clipboard unavailable — no-op */
    }
}
</script>
```

The `<template>` and `<style>` blocks are unchanged.

- [ ] **Step 7: Build devtools**

```bash
pnpm --filter @ametie/vue-muza-devtools build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add packages/devtools/src/features/network/components/DataPane.vue \
        packages/devtools/src/features/network/components/PayloadPane.vue
git commit -m "fix(devtools): eliminate KV format flash by hoisting format ref to module scope"
```

---

## Task 3 — Feature badges survive SPA navigation

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts`
- Modify: `packages/devtools/src/shared/store/devtoolsStore.ts`
- Modify: `packages/devtools/src/features/network/components/RequestList.vue`
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

**Root cause:** `RequestList.vue` resolves `instanceOptions` at render time via `instances.value.get(instanceId)?.options`. When a `useApi` composable unmounts on SPA navigation, `unregisterInstance()` removes it from the `instances` map. All rendered rows for that instance return `undefined` and `FeatureBadges` hides.

**Fix:** Snapshot `instanceOptions` into `RequestRecord` when the request is created. The request becomes self-contained.

- [ ] **Step 9: Add `instanceOptions` field to `RequestRecord` in types/index.ts**

After the `truncated: boolean;` field (line 74), add:

```ts
    /** Snapshot of the instance's feature options taken at request creation time. Populated if the instance was registered; undefined for batch or untracked requests. */
    instanceOptions: DevtoolsInstanceOptions | undefined;
```

The `RequestRecord` interface now looks like:

```ts
export interface RequestRecord {
    id: string;
    instanceId: string | null;
    url: string;
    method: string;
    startedAt: number;
    duration: number | null;
    status: RequestStatus;
    statusCode: number | null;
    requestHeaders: Record<string, string>;
    payload: unknown;
    queryParams: unknown;
    response: unknown;
    error: ApiError | null;
    truncated: boolean;
    instanceOptions: DevtoolsInstanceOptions | undefined;
}
```

- [ ] **Step 10: Update addRequest in devtoolsStore.ts to snapshot instanceOptions**

The `addRequest` parameter type must omit `instanceOptions` (it's derived internally). Update the function signature and body:

```ts
export function addRequest(
    partial: Omit<RequestRecord, "duration" | "response" | "error" | "truncated" | "instanceOptions">,
): void {
    const { value: truncatedPayload, truncated: payloadTruncated } = truncateValue(partial.payload, state.config.maxPayloadSize);
    const { value: truncatedQueryParams, truncated: queryParamsTruncated } = truncateValue(partial.queryParams, state.config.maxPayloadSize);
    const record: RequestRecord = {
        ...partial,
        payload: truncatedPayload,
        queryParams: truncatedQueryParams,
        duration: null,
        response: null,
        error: null,
        truncated: payloadTruncated || queryParamsTruncated,
        instanceOptions: partial.instanceId
            ? state.instances.get(partial.instanceId)?.options
            : undefined,
    };
    if (state.requests.length >= state.config.maxHistory) {
        state.requests.shift();
    }
    state.requests.push(record);

    if (partial.instanceId) {
        const instance = state.instances.get(partial.instanceId);
        if (instance) {
            instance.requestCount++;
            instance.lastRequestAt = partial.startedAt;
        }
    }
}
```

Also update the `DevtoolsBridge` type in `types/index.ts` — the `onRequestStart` callback uses the same Omit. Update line 198:

```ts
onRequestStart: (record: Omit<RequestRecord, "duration" | "response" | "error" | "truncated" | "instanceOptions">) => void;
```

- [ ] **Step 11: Update RequestList.vue — remove getInstanceOptions, pass directly from record**

Replace the entire `<script setup>` block:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { RequestRecord } from "../../../shared/types/index";
import RequestRow from "./RequestRow.vue";

const props = defineProps<{
    requests: ReadonlyArray<RequestRecord>;
    activeRequestId: string | null;
}>();
defineEmits<{ (e: "select", id: string): void }>();

const parentRef = ref<HTMLElement | null>(null);

const rowVirtualizer = useVirtualizer(
    computed(() => ({
        count: props.requests.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => 52,
        overscan: 10,
    })),
);
</script>
```

Update the template's `:instance-options` binding (the `<RequestRow>` line):

```html
<RequestRow
    :request="requests[vRow.index]"
    :is-active="requests[vRow.index].id === activeRequestId"
    :instance-options="requests[vRow.index].instanceOptions"
    @select="$emit('select', $event)"
/>
```

- [ ] **Step 12: Simplify selectedInstanceOptions in NetworkTab.vue**

The computed at lines 28–32 currently looks up from the live `instances` map. Replace it with a direct read from the selected request:

```ts
const selectedInstanceOptions = computed<DevtoolsInstanceOptions | undefined>(() =>
    selectedRequest.value?.instanceOptions,
);
```

Remove the now-unused `import type { SelectOption }` line for `DevtoolsInstanceOptions` from the instances import if it's no longer used elsewhere in the file — or keep it if it's still referenced. (Check: `DevtoolsInstanceOptions` is still used in the `selectedInstanceOptions` return type, so keep the import.)

- [ ] **Step 13: Build devtools and use-api**

```bash
pnpm --filter @ametie/vue-muza-devtools build && pnpm --filter @ametie/vue-muza-use build
```

Expected: both packages build with no TypeScript errors.

- [ ] **Step 14: Run use-api tests**

```bash
pnpm --filter @ametie/vue-muza-use test --run
```

Expected: all tests pass (the `onRequestStart` call in `useApi.ts` does not pass `instanceOptions`, which is now correctly excluded from the parameter type — no breakage).

- [ ] **Step 15: Commit**

```bash
git add packages/devtools/src/shared/types/index.ts \
        packages/devtools/src/shared/store/devtoolsStore.ts \
        packages/devtools/src/features/network/components/RequestList.vue \
        packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "fix(devtools): snapshot instanceOptions into RequestRecord so feature badges survive navigation"
```

---

## Final — Build both packages and run full test suite

- [ ] **Step 16: Full build + test**

```bash
pnpm build && pnpm --filter @ametie/vue-muza-use test --run
```

Expected: clean build, all tests pass.
