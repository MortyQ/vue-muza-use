# Devtools: Payload Tree View & Query Params — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible tree view for KV data, show query params separately from body in the Payload pane, default panel mode to "side", and persist the KV/JSON format preference.

**Architecture:** New shared `TreeNode.vue` (recursive) + `TreeViewer.vue` replace flat `KvViewer.vue`. New `PayloadPane.vue` wraps two sections (Query Params + Body) and owns the format preference. `RequestRecord` gets a `queryParams` field captured separately in `useApi.ts`.

**Tech Stack:** Vue 3 `<script setup>`, `idb-keyval`, Vitest, `@vue/test-utils`, `flushPromises`

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/devtools/src/shared/storage/devtoolsStorage.ts` |
| Modify | `packages/devtools/src/shared/storage/devtoolsStorage.test.ts` |
| Modify | `packages/devtools/src/features/panel/composables/useFloatingPanel.ts` |
| Modify | `packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts` |
| Modify | `packages/devtools/src/features/panel/components/Panel.test.ts` |
| Modify | `packages/devtools/src/shared/types/index.ts` |
| Modify | `packages/devtools/src/shared/store/devtoolsStore.ts` |
| Modify | `packages/devtools/src/shared/store/devtoolsStore.test.ts` |
| Modify | `packages/devtools/src/shared/instrumentation/instrumentation.test.ts` |
| Modify | `packages/use-api/src/useApi.ts` |
| Create | `packages/devtools/src/shared/components/TreeNode.vue` |
| Create | `packages/devtools/src/shared/components/TreeNode.test.ts` |
| Create | `packages/devtools/src/shared/components/TreeViewer.vue` |
| Create | `packages/devtools/src/shared/components/TreeViewer.test.ts` |
| Modify | `packages/devtools/src/features/network/components/DataPane.vue` |
| Create | `packages/devtools/src/features/network/components/PayloadPane.vue` |
| Create | `packages/devtools/src/features/network/components/PayloadPane.test.ts` |
| Modify | `packages/devtools/src/features/network/components/SplitView.vue` |
| Modify | `packages/devtools/src/features/network/components/RequestDetail.vue` |
| Delete | `packages/devtools/src/features/network/components/KvViewer.vue` |

---

## Task 1: Storage — payloadFormat key + loadPanelMode default "side"

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.test.ts`

- [ ] **Step 1: Add to `devtoolsStorage.ts`**

Add `payloadFormat` to the `KEYS` object and add two new functions. Also change `loadPanelMode` default from `"bottom"` to `"side"`.

```ts
// In KEYS object, add:
payloadFormat: "vmd:payload-format",

// Change loadPanelMode default:
export async function loadPanelMode(): Promise<PanelMode> {
    return (await get<PanelMode>(KEYS.panelMode)) ?? "side";
}

// Add at the end of the file:
/**
 * Loads the saved payload viewer format from IndexedDB. Returns "kv" if not previously saved.
 */
export async function loadPayloadFormat(): Promise<"kv" | "json"> {
    return (await get<"kv" | "json">(KEYS.payloadFormat)) ?? "kv";
}

/**
 * Saves the payload viewer format to IndexedDB.
 */
export async function savePayloadFormat(format: "kv" | "json"): Promise<void> {
    return set(KEYS.payloadFormat, format);
}
```

- [ ] **Step 2: Update `devtoolsStorage.test.ts`**

Update the existing `loadPanelMode` default test and add a new `payloadFormat` describe block.

Change line 93 in the existing `loadPanelMode` test:
```ts
// Before:
it("loadPanelMode returns \"bottom\" as default when get resolves undefined", async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    const result = await loadPanelMode();
    expect(get).toHaveBeenCalledWith("vmd:panel-mode");
    expect(result).toBe("bottom");
});

// After:
it("loadPanelMode returns \"side\" as default when get resolves undefined", async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    const result = await loadPanelMode();
    expect(get).toHaveBeenCalledWith("vmd:panel-mode");
    expect(result).toBe("side");
});
```

Add these imports to the import statement at the top and a new test block at the bottom:
```ts
// Add to imports:
import {
    // ...existing...
    loadPayloadFormat,
    savePayloadFormat,
} from "./devtoolsStorage";

// Add at the end of the file:
describe("loadPayloadFormat / savePayloadFormat", () => {
    it("loadPayloadFormat returns \"kv\" as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadPayloadFormat();
        expect(get).toHaveBeenCalledWith("vmd:payload-format");
        expect(result).toBe("kv");
    });

    it("loadPayloadFormat returns saved value", async () => {
        vi.mocked(get).mockResolvedValue("json");
        const result = await loadPayloadFormat();
        expect(result).toBe("json");
    });

    it("savePayloadFormat calls set with correct key and value", async () => {
        await savePayloadFormat("json");
        expect(set).toHaveBeenCalledWith("vmd:payload-format", "json");
    });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass (the `loadPanelMode` default test now asserts `"side"`).

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.ts packages/devtools/src/shared/storage/devtoolsStorage.test.ts
git commit -m "feat(devtools): add payloadFormat storage key and change loadPanelMode default to side"
```

---

## Task 2: Default panel mode = "side" in useFloatingPanel.ts

**Files:**
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.ts`
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts`
- Modify: `packages/devtools/src/features/panel/components/Panel.test.ts`

- [ ] **Step 1: Update `useFloatingPanel.ts`**

Change the module-level singleton default and the reset function:

```ts
// Before:
const _panelMode = ref<PanelMode>("bottom");

// After:
const _panelMode = ref<PanelMode>("side");
```

```ts
// Before:
export function _resetPanelModeForTesting(): void {
    _isOpen.value = false;
    _panelMode.value = "bottom";
    _panelModeLoaded = false;
}

// After:
export function _resetPanelModeForTesting(): void {
    _isOpen.value = false;
    _panelMode.value = "side";
    _panelModeLoaded = false;
}
```

- [ ] **Step 2: Update `useFloatingPanel.test.ts`**

The mock at the top of `useFloatingPanel.test.ts` returns `"bottom"` for `loadPanelMode`. The "initial state" test checks the pre-hydration default. Update both:

```ts
// In the vi.mock at the top, change the loadPanelMode mock — keep returning "bottom" so
// hydration tests still verify that the IDB value wins over the default:
loadPanelMode: vi.fn().mockResolvedValue("bottom"),   // unchanged — tests hydration

// Update the "initial state" test:
it("starts with height 360, sideWidth 380, mode 'side', and closed", () => {
    const { result, unmount } = withSetup(() => useFloatingPanel());
    expect(result.height.value).toBe(360);
    expect(result.sideWidth.value).toBe(380);
    expect(result.panelMode.value).toBe("side");
    expect(result.isOpen.value).toBe(false);
    unmount();
});
```

- [ ] **Step 3: Update `Panel.test.ts` — add payloadFormat to the storage mock**

The Panel.test.ts mock for `devtoolsStorage` must include the two new functions added in Task 1. Find the `vi.mock("../../../shared/storage/devtoolsStorage", ...)` block and add:

```ts
vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelPosition: vi.fn(), savePanelPosition: vi.fn(),
    loadPanelSize: vi.fn(), savePanelSize: vi.fn(),
    loadActiveTab: vi.fn(), saveActiveTab: vi.fn(),
    loadPanelHeight: vi.fn().mockResolvedValue(undefined), savePanelHeight: vi.fn(),
    loadPanelMode: vi.fn().mockResolvedValue("bottom"), savePanelMode: vi.fn(),
    loadPanelSideWidth: vi.fn().mockResolvedValue(undefined), savePanelSideWidth: vi.fn(),
    loadNetworkToolbarVisible: vi.fn().mockResolvedValue(true), saveNetworkToolbarVisible: vi.fn(),
    loadNetworkFilterVisible: vi.fn().mockResolvedValue(true), saveNetworkFilterVisible: vi.fn(),
    loadSplitPayloadWidth: vi.fn().mockResolvedValue(undefined), saveSplitPayloadWidth: vi.fn(),
    loadPayloadFormat: vi.fn().mockResolvedValue("kv"), savePayloadFormat: vi.fn(),  // ← new
}));
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/panel/composables/useFloatingPanel.ts packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts packages/devtools/src/features/panel/components/Panel.test.ts
git commit -m "feat(devtools): default panel mode to side"
```

---

## Task 3: Add queryParams to RequestRecord type

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts`

- [ ] **Step 1: Update `RequestRecord` in `types/index.ts`**

Add `queryParams` field and update the `payload` JSDoc to clarify it is body only:

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
    /** Request body only; may be truncated. Does not include query params. */
    payload: unknown;
    /** Query params passed to the request; may be truncated. */
    queryParams: unknown;
    response: unknown;
    error: ApiError | null;
    truncated: boolean;
}
```

- [ ] **Step 2: Run type-check to see all call sites that now fail**

```bash
pnpm --filter @ametie/vue-muza-devtools build 2>&1 | head -40
```

This reveals every `addRequest`/`onRequestStart` call missing `queryParams`. Fix them in Tasks 4 and 5.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/shared/types/index.ts
git commit -m "feat(devtools): add queryParams field to RequestRecord"
```

---

## Task 4: Update devtoolsStore + all addRequest test call sites

**Files:**
- Modify: `packages/devtools/src/shared/store/devtoolsStore.ts`
- Modify: `packages/devtools/src/shared/store/devtoolsStore.test.ts`
- Modify: `packages/devtools/src/shared/instrumentation/instrumentation.test.ts`
- Modify: `packages/devtools/src/features/network/composables/network.test.ts` (if it has addRequest calls)
- Modify: `packages/devtools/src/features/timeline/composables/timeline.test.ts` (if it has addRequest calls)
- Modify: `packages/devtools/src/app/app.test.ts` (if it has onRequestStart calls)

- [ ] **Step 1: Update `addRequest` in `devtoolsStore.ts`**

Truncate `queryParams` alongside `payload`:

```ts
export function addRequest(
    partial: Omit<RequestRecord, "duration" | "response" | "error" | "truncated">,
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

- [ ] **Step 2: Update all `addRequest` calls in `devtoolsStore.test.ts`**

Every `addRequest({...})` call is missing `queryParams`. Add `queryParams: null` to each one. There are ~10 occurrences — find them all with:

```bash
grep -n "addRequest(" packages/devtools/src/shared/store/devtoolsStore.test.ts
```

Pattern to apply — for each call, add `queryParams: null`:

```ts
// Before (example):
addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
    startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null });

// After:
addRequest({ id: "r1", instanceId: "id-1", url: "/users", method: "GET",
    startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {}, payload: null, queryParams: null });
```

Also add a test for queryParams truncation in the `"addRequest — payload truncation"` describe block:

```ts
it("truncates queryParams that exceed maxPayloadSize", () => {
    const bigParams = { q: "a".repeat(200) };
    addRequest({ id: "r1", instanceId: null, url: "/u", method: "GET",
        startedAt: Date.now(), status: "pending", statusCode: null, requestHeaders: {},
        payload: null, queryParams: bigParams });
    expect(requests.value[0].truncated).toBe(true);
    expect(typeof requests.value[0].queryParams).toBe("string");
});
```

- [ ] **Step 3: Update `onRequestStart` call in `instrumentation.test.ts`**

```bash
grep -n "onRequestStart\|payload:" packages/devtools/src/shared/instrumentation/instrumentation.test.ts
```

Find the record object literal and add `queryParams: null`:

```ts
// Before:
{ id: "req-1", instanceId: null, url: "/u", method: "GET",
  startedAt: 1000, status: "pending" as const, statusCode: null, requestHeaders: {}, payload: null }

// After:
{ id: "req-1", instanceId: null, url: "/u", method: "GET",
  startedAt: 1000, status: "pending" as const, statusCode: null, requestHeaders: {}, payload: null, queryParams: null }
```

- [ ] **Step 4: Update `network.test.ts` and `timeline.test.ts` if they have addRequest calls**

```bash
grep -n "addRequest\|payload:" packages/devtools/src/features/network/composables/network.test.ts | head -20
grep -n "addRequest\|payload:" packages/devtools/src/features/timeline/composables/timeline.test.ts | head -20
```

Apply the same `queryParams: null` addition to every call found.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/devtools/src/shared/store/devtoolsStore.ts packages/devtools/src/shared/store/devtoolsStore.test.ts packages/devtools/src/shared/instrumentation/instrumentation.test.ts packages/devtools/src/features/network/composables/network.test.ts packages/devtools/src/features/timeline/composables/timeline.test.ts packages/devtools/src/app/app.test.ts
git commit -m "feat(devtools): store and truncate queryParams in devtoolsStore"
```

---

## Task 5: Capture queryParams separately in useApi.ts

**Files:**
- Modify: `packages/use-api/src/useApi.ts`

- [ ] **Step 1: Update the `devtoolsBridge.onRequestStart` call in `useApi.ts`**

Find the `onRequestStart` call (around line 247). Change:

```ts
// Before:
devtoolsBridge.onRequestStart({
    id: devtoolsRequestId,
    instanceId,
    url: requestUrl,
    method,
    startedAt: devtoolsRequestStartedAt,
    status: "pending",
    statusCode: null,
    requestHeaders: {},
    payload: resolvedData ?? resolvedParams ?? null,
});

// After:
devtoolsBridge.onRequestStart({
    id: devtoolsRequestId,
    instanceId,
    url: requestUrl,
    method,
    startedAt: devtoolsRequestStartedAt,
    status: "pending",
    statusCode: null,
    requestHeaders: {},
    payload: resolvedData ?? null,
    queryParams: resolvedParams ?? null,
});
```

- [ ] **Step 2: Run the main library tests**

```bash
pnpm --filter @ametie/vue-muza-use test --run
```

Expected: all tests pass. If any test calls `onRequestStart` with a literal object, it will fail — add `queryParams: null` to that object.

- [ ] **Step 3: Run devtools tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

- [ ] **Step 4: Commit**

```bash
git add packages/use-api/src/useApi.ts
git commit -m "feat(devtools): capture queryParams separately from payload in useApi"
```

---

## Task 6: TreeNode.vue — recursive collapsible node

**Files:**
- Create: `packages/devtools/src/shared/components/TreeNode.vue`
- Create: `packages/devtools/src/shared/components/TreeNode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/devtools/src/shared/components/TreeNode.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TreeNode from "./TreeNode.vue";

describe("TreeNode — primitives", () => {
    it("renders a string value with quotes", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "name", value: "Alice", depth: 0 } });
        expect(wrapper.text()).toContain('"Alice"');
    });

    it("renders a number value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "count", value: 42, depth: 0 } });
        expect(wrapper.text()).toContain("42");
    });

    it("renders a boolean value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "active", value: true, depth: 0 } });
        expect(wrapper.text()).toContain("true");
    });

    it("renders null value", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "deleted", value: null, depth: 0 } });
        expect(wrapper.text()).toContain("null");
    });

    it("renders the key label", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "myKey", value: "val", depth: 0 } });
        expect(wrapper.text()).toContain("myKey");
    });

    it("hides the arrow for leaf nodes", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "x", value: 1, depth: 0 } });
        expect(wrapper.find(".tree-arrow").attributes("style")).toContain("visibility: hidden");
    });
});

describe("TreeNode — object", () => {
    it("renders Object badge with count", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1, b: 2 }, depth: 0 } });
        expect(wrapper.text()).toContain("Object {2}");
    });

    it("shows arrow as visible for objects", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.find(".tree-arrow").attributes("style") ?? "").not.toContain("visibility: hidden");
    });

    it("does not show children by default (collapsed)", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: 1 }, depth: 0 } });
        expect(wrapper.text()).not.toContain('"a"');
    });

    it("expands children when arrow is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.text()).toContain("a");
        expect(wrapper.text()).toContain('"hello"');
    });

    it("expands children when badge is clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.text()).toContain("a");
        expect(wrapper.text()).toContain('"hello"');
    });

    it("collapses when clicked again", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "obj", value: { a: "hello" }, depth: 0 } });
        await wrapper.find(".tree-arrow").trigger("click");
        await wrapper.find(".tree-arrow").trigger("click");
        expect(wrapper.text()).not.toContain('"hello"');
    });
});

describe("TreeNode — array", () => {
    it("renders Array badge with length", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "items", value: [1, 2, 3], depth: 0 } });
        expect(wrapper.text()).toContain("Array [3]");
    });

    it("expands array items with numeric index as key when badge clicked", async () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "tags", value: ["a", "b"], depth: 0 } });
        await wrapper.find(".tree-badge").trigger("click");
        expect(wrapper.text()).toContain("0");
        expect(wrapper.text()).toContain('"a"');
        expect(wrapper.text()).toContain("1");
        expect(wrapper.text()).toContain('"b"');
    });
});

describe("TreeNode — depth indent", () => {
    it("applies paddingLeft based on depth", () => {
        const wrapper = mount(TreeNode, { props: { nodeKey: "x", value: 1, depth: 3 } });
        const row = wrapper.find(".tree-row");
        expect(row.attributes("style")).toContain("padding-left: 42px");
    });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- TreeNode --run 2>&1 | tail -10
```

Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Create `TreeNode.vue`**

```vue
<!-- Recursive tree node. Both the ▶/▼ arrow and the Object/Array badge toggle expand. -->
<script lang="ts">
export default { name: "TreeNode" }
</script>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
    nodeKey: string | number | null;
    value: unknown;
    depth: number;
}>();

const expanded = ref(false);

const isExpandable = computed(
    () => typeof props.value === "object" && props.value !== null,
);
const isArray = computed(() => Array.isArray(props.value));

const badgeLabel = computed((): string => {
    if (!isExpandable.value) return "";
    if (isArray.value) return `Array [${(props.value as unknown[]).length}]`;
    return `Object {${Object.keys(props.value as object).length}}`;
});

const childEntries = computed((): Array<[string | number, unknown]> => {
    if (!expanded.value || !isExpandable.value) return [];
    if (isArray.value) return (props.value as unknown[]).map((v, i) => [i, v]);
    return Object.entries(props.value as Record<string, unknown>);
});

const displayValue = computed((): string => {
    if (props.value === null) return "null";
    if (typeof props.value === "string") return `"${props.value}"`;
    return String(props.value);
});

const valueClass = computed((): string => {
    if (props.value === null) return "tree-val tree-val--null";
    if (typeof props.value === "string") return "tree-val tree-val--string";
    if (typeof props.value === "number") return "tree-val tree-val--number";
    if (typeof props.value === "boolean") return "tree-val tree-val--boolean";
    return "tree-val";
});

const indentPx = computed(() => props.depth * 14);

function toggle(): void {
    if (isExpandable.value) expanded.value = !expanded.value;
}
</script>

<template>
    <div class="tree-node">
        <div class="tree-row" :style="{ paddingLeft: indentPx + 'px' }">
            <span
                class="tree-arrow"
                :style="{ visibility: isExpandable ? 'visible' : 'hidden' }"
                @click="toggle"
            >{{ expanded ? "▼" : "▶" }}</span>
            <span v-if="nodeKey !== null" class="tree-key">{{ nodeKey }}</span>
            <span v-if="nodeKey !== null" class="tree-colon">:</span>
            <span v-if="isExpandable" class="tree-badge" @click="toggle">
                {{ expanded ? "▼" : "▶" }} {{ badgeLabel }}
            </span>
            <span v-else :class="valueClass">{{ displayValue }}</span>
        </div>
        <TreeNode
            v-for="[k, v] in childEntries"
            :key="k"
            :node-key="k"
            :value="v"
            :depth="depth + 1"
        />
    </div>
</template>

<style scoped>
.tree-node { font-family: "SF Mono", "Fira Code", Consolas, monospace; font-size: 12px; }
.tree-row {
    display: flex;
    align-items: center;
    gap: 3px;
    line-height: 1.7;
    min-height: 22px;
}
.tree-row:hover { background: var(--dt-surface-raised, #ffffff08); }
.tree-arrow {
    width: 14px;
    flex-shrink: 0;
    color: var(--dt-foreground-subtle, #6b7280);
    font-size: 8px;
    cursor: pointer;
    user-select: none;
}
.tree-arrow:hover { color: var(--dt-primary, #a78bfa); }
.tree-key { color: oklch(72% 0.17 290); flex-shrink: 0; }
.tree-colon { color: var(--dt-border-strong, #374151); flex-shrink: 0; }
.tree-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--dt-surface-raised, #1e1b4b);
    border: 1px solid var(--dt-border, #3730a3);
    color: oklch(72% 0.17 260);
    border-radius: 3px;
    padding: 0 6px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
}
.tree-badge:hover {
    background: var(--dt-primary-subtle, #312e81);
    color: var(--dt-primary, #a78bfa);
}
.tree-val { }
.tree-val--string  { color: oklch(72% 0.17 145); }
.tree-val--number  { color: oklch(74% 0.18 55); }
.tree-val--boolean { color: oklch(72% 0.18 25); }
.tree-val--null    { color: var(--dt-foreground-subtle, #6b7280); }
</style>
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- TreeNode --run
```

Expected: all TreeNode tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/shared/components/TreeNode.vue packages/devtools/src/shared/components/TreeNode.test.ts
git commit -m "feat(devtools): add TreeNode recursive collapsible component"
```

---

## Task 7: TreeViewer.vue — top-level tree wrapper

**Files:**
- Create: `packages/devtools/src/shared/components/TreeViewer.vue`
- Create: `packages/devtools/src/shared/components/TreeViewer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/devtools/src/shared/components/TreeViewer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TreeViewer from "./TreeViewer.vue";

describe("TreeViewer", () => {
    it("renders nothing for null value", () => {
        const wrapper = mount(TreeViewer, { props: { value: null } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders nothing for undefined value", () => {
        const wrapper = mount(TreeViewer, { props: { value: undefined } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders nothing for a primitive string (not an object)", () => {
        const wrapper = mount(TreeViewer, { props: { value: "hello" } });
        expect(wrapper.find(".tree-node").exists()).toBe(false);
    });

    it("renders a TreeNode for each top-level key of an object", () => {
        const wrapper = mount(TreeViewer, { props: { value: { a: 1, b: 2 } } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(2);
    });

    it("renders a TreeNode for each item in an array", () => {
        const wrapper = mount(TreeViewer, { props: { value: [10, 20, 30] } });
        expect(wrapper.findAll(".tree-node")).toHaveLength(3);
    });

    it("shows correct key labels from object", () => {
        const wrapper = mount(TreeViewer, { props: { value: { username: "alice" } } });
        expect(wrapper.text()).toContain("username");
        expect(wrapper.text()).toContain('"alice"');
    });

    it("shows numeric indices for array items", () => {
        const wrapper = mount(TreeViewer, { props: { value: ["x"] } });
        expect(wrapper.text()).toContain("0");
        expect(wrapper.text()).toContain('"x"');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- TreeViewer --run 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Create `TreeViewer.vue`**

```vue
<!-- Top-level tree viewer. Iterates entries and renders one TreeNode per entry. -->
<script setup lang="ts">
import { computed } from "vue";
import TreeNode from "./TreeNode.vue";

const props = defineProps<{ value: unknown }>();

const entries = computed((): Array<[string | number, unknown]> => {
    if (props.value === null || props.value === undefined) return [];
    if (Array.isArray(props.value)) return props.value.map((v, i) => [i, v]);
    if (typeof props.value === "object") return Object.entries(props.value as Record<string, unknown>);
    return [];
});
</script>

<template>
    <div class="tree-viewer">
        <TreeNode
            v-for="[key, val] in entries"
            :key="key"
            :node-key="key"
            :value="val"
            :depth="0"
        />
    </div>
</template>

<style scoped>
.tree-viewer { padding: 4px 0; }
</style>
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- TreeViewer --run
```

Expected: all TreeViewer tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/shared/components/TreeViewer.vue packages/devtools/src/shared/components/TreeViewer.test.ts
git commit -m "feat(devtools): add TreeViewer shared component"
```

---

## Task 8: Update DataPane.vue to use TreeViewer

**Files:**
- Modify: `packages/devtools/src/features/network/components/DataPane.vue`

- [ ] **Step 1: Replace `KvViewer` with `TreeViewer` in `DataPane.vue`**

```vue
<!-- Change the import: -->
<!-- Before: import KvViewer from "./KvViewer.vue"; -->
import TreeViewer from "../../../shared/components/TreeViewer.vue";

<!-- Change the template usage: -->
<!-- Before: <KvViewer v-else :value="data" /> -->
<TreeViewer v-else :value="data" />
```

The full updated `<script setup>` block:

```vue
<script setup lang="ts">
import { ref } from "vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";

const props = defineProps<{
    title: string;
    data: unknown;
    truncated?: boolean;
}>();

const mode = ref<"json" | "kv">("json");

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2));
    } catch {
        /* clipboard unavailable — no-op */
    }
}
</script>
```

And the template `<KvViewer v-else :value="data" />` → `<TreeViewer v-else :value="data" />`.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass (DataPane is tested indirectly via Panel.test.ts).

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/components/DataPane.vue
git commit -m "feat(devtools): replace KvViewer with TreeViewer in DataPane"
```

---

## Task 9: PayloadPane.vue — two-section payload pane

**Files:**
- Create: `packages/devtools/src/features/network/components/PayloadPane.vue`
- Create: `packages/devtools/src/features/network/components/PayloadPane.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/devtools/src/features/network/components/PayloadPane.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import PayloadPane from "./PayloadPane.vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPayloadFormat: vi.fn().mockResolvedValue("kv"),
    savePayloadFormat: vi.fn().mockResolvedValue(undefined),
}));

import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPayloadFormat).mockResolvedValue("kv");
});

describe("PayloadPane — query params section", () => {
    it("shows 'No params' when queryParams is null", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No params");
    });

    it("shows 'No params' when queryParams is empty object", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: {}, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No params");
    });

    it("renders query params when present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { q: "search" }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("q");
        expect(wrapper.text()).toContain('"search"');
    });

    it("shows the param count badge when params present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { a: 1, b: 2, c: 3 }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("3");
    });
});

describe("PayloadPane — body section", () => {
    it("shows 'No body' when payload is null", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: null, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("No body");
    });

    it("renders body when payload is present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { name: "Alice" }, truncated: false },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("name");
        expect(wrapper.text()).toContain('"Alice"');
    });

    it("shows truncated warning when truncated is true and payload present", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { x: 1 }, truncated: true },
        });
        await flushPromises();
        expect(wrapper.text()).toContain("[truncated]");
    });
});

describe("PayloadPane — format toggle", () => {
    it("loads saved format on mount", async () => {
        vi.mocked(loadPayloadFormat).mockResolvedValue("json");
        const wrapper = mount(PayloadPane, {
            props: { queryParams: { q: "x" }, payload: null, truncated: false },
        });
        await flushPromises();
        expect(loadPayloadFormat).toHaveBeenCalledOnce();
        // KV button should not be active (format is json)
        const kvBtn = wrapper.find(".pane-action--active");
        expect(kvBtn.exists()).toBe(false);
    });

    it("saves format when toggled", async () => {
        const wrapper = mount(PayloadPane, {
            props: { queryParams: null, payload: { x: 1 }, truncated: false },
        });
        await flushPromises();
        await wrapper.find("button.pane-action").trigger("click"); // KV toggle
        expect(savePayloadFormat).toHaveBeenCalledWith("json");
    });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- PayloadPane --run 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Create `PayloadPane.vue`**

```vue
<!-- Payload pane: two sections — Query Params (top) and Body (bottom). Persists KV/JSON format. -->
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import TreeViewer from "../../../shared/components/TreeViewer.vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import { loadPayloadFormat, savePayloadFormat } from "../../../shared/storage/devtoolsStorage";

const props = defineProps<{
    queryParams: unknown;
    payload: unknown;
    truncated: boolean;
}>();

const format = ref<"kv" | "json">("kv");

const hasQueryParams = computed(
    () =>
        props.queryParams !== null &&
        props.queryParams !== undefined &&
        typeof props.queryParams === "object" &&
        Object.keys(props.queryParams as object).length > 0,
);

const queryParamCount = computed((): number => {
    if (!hasQueryParams.value) return 0;
    return Object.keys(props.queryParams as object).length;
});

const hasBody = computed(() => props.payload !== null && props.payload !== undefined);

onMounted(async () => {
    format.value = await loadPayloadFormat();
});

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

<template>
    <div class="payload-pane">
        <div class="pane-header">
            <span class="pane-title">PAYLOAD</span>
            <button
                class="pane-action"
                :class="{ 'pane-action--active': format === 'kv' }"
                @click="toggleFormat"
            >KV</button>
            <button class="pane-action" @click="copy">Copy</button>
        </div>

        <!-- Query Params section -->
        <div class="section-label">
            <span>Query Params</span>
            <span v-if="hasQueryParams" class="section-count">{{ queryParamCount }}</span>
        </div>
        <div v-if="hasQueryParams" class="section-body">
            <TreeViewer v-if="format === 'kv'" :value="queryParams" />
            <JsonViewer v-else :value="queryParams" />
        </div>
        <p v-else class="section-empty">No params</p>

        <div class="section-divider" />

        <!-- Body section -->
        <div class="section-label"><span>Body</span></div>
        <div v-if="hasBody" class="section-body">
            <p v-if="truncated" class="truncated-warning">[truncated]</p>
            <TreeViewer v-if="format === 'kv'" :value="payload" />
            <JsonViewer v-else :value="payload" />
        </div>
        <p v-else class="section-empty">No body</p>
    </div>
</template>

<style scoped>
.payload-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}
.pane-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.pane-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.6px;
    color: var(--dt-foreground-muted);
    flex: 1;
}
.pane-action {
    height: 22px;
    padding: 0 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--dt-border);
    background: transparent;
    color: var(--dt-foreground-muted);
    transition: all 0.12s;
    flex-shrink: 0;
}
.pane-action:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
    border-color: var(--dt-border-strong);
}
.pane-action--active {
    background: var(--dt-primary-subtle);
    color: var(--dt-primary);
    border-color: var(--dt-primary);
}
.section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dt-foreground-subtle);
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.section-count {
    background: var(--dt-primary-subtle);
    color: var(--dt-primary);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 9px;
}
.section-body {
    overflow: auto;
    padding: 6px 12px;
    flex-shrink: 0;
    max-height: 50%;
}
.section-body::-webkit-scrollbar { width: 4px; height: 4px; }
.section-body::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.section-empty {
    padding: 8px 12px;
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: var(--dt-foreground-subtle);
    flex-shrink: 0;
}
.section-divider {
    height: 1px;
    background: var(--dt-border-subtle);
    flex-shrink: 0;
}
.truncated-warning {
    font-size: 11px;
    color: var(--dt-warning);
    margin-bottom: 8px;
}
</style>
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- PayloadPane --run
```

Expected: all PayloadPane tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/network/components/PayloadPane.vue packages/devtools/src/features/network/components/PayloadPane.test.ts
git commit -m "feat(devtools): add PayloadPane with query params and body sections"
```

---

## Task 10: Wire PayloadPane into SplitView.vue and RequestDetail.vue

**Files:**
- Modify: `packages/devtools/src/features/network/components/SplitView.vue`
- Modify: `packages/devtools/src/features/network/components/RequestDetail.vue`

- [ ] **Step 1: Update `SplitView.vue` — replace DataPane (payload) with PayloadPane**

Change the import and the payload pane usage:

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, onScopeDispose } from "vue";
import DataPane from "./DataPane.vue";
import PayloadPane from "./PayloadPane.vue";      // ← add
import type { RequestRecord } from "../../../shared/types/index";
import { useFloatingPanel } from "../../panel/composables/useFloatingPanel";
import { loadSplitPayloadWidth, saveSplitPayloadWidth } from "../../../shared/storage/devtoolsStorage";
// ... rest of script unchanged
```

In the template, replace:
```vue
<!-- Before: -->
<DataPane title="Payload" :data="request.payload" :truncated="request.truncated" />

<!-- After: -->
<PayloadPane
    :query-params="request.queryParams"
    :payload="request.payload"
    :truncated="request.truncated"
/>
```

- [ ] **Step 2: Update `RequestDetail.vue` — replace DataPane for the Payload tab with PayloadPane**

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { RequestRecord, DevtoolsInstanceOptions } from "../../../shared/types/index";
import DetailHeader from "./DetailHeader.vue";
import DetailTabs from "./DetailTabs.vue";
import SplitView from "./SplitView.vue";
import DataPane from "./DataPane.vue";
import PayloadPane from "./PayloadPane.vue";    // ← add

defineProps<{ request: RequestRecord; instanceOptions?: DevtoolsInstanceOptions }>();
defineEmits<{ close: [] }>();

type TabId = "split" | "payload" | "response" | "headers";
const activeTab = ref<TabId>("split");
</script>
```

In the template, replace the payload tab DataPane:
```vue
<!-- Before: -->
<DataPane
    v-else-if="activeTab === 'payload'"
    title="Payload"
    :data="request.payload"
    :truncated="request.truncated"
/>

<!-- After: -->
<PayloadPane
    v-else-if="activeTab === 'payload'"
    :query-params="request.queryParams"
    :payload="request.payload"
    :truncated="request.truncated"
/>
```

- [ ] **Step 3: Run all tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/network/components/SplitView.vue packages/devtools/src/features/network/components/RequestDetail.vue
git commit -m "feat(devtools): wire PayloadPane into SplitView and RequestDetail"
```

---

## Task 11: Delete KvViewer.vue + run full test suite

**Files:**
- Delete: `packages/devtools/src/features/network/components/KvViewer.vue`

- [ ] **Step 1: Verify KvViewer has no remaining usages**

```bash
grep -r "KvViewer" packages/devtools/src/
```

Expected: no results. If any files still import it, update them to use `TreeViewer` before deleting.

- [ ] **Step 2: Delete the file**

```bash
rm packages/devtools/src/features/network/components/KvViewer.vue
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run && pnpm --filter @ametie/vue-muza-use test --run
```

Expected: all tests pass across both packages.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(devtools): remove KvViewer — replaced by TreeViewer"
```
