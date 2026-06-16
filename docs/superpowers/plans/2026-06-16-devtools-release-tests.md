# Devtools Release — Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining test gaps before releasing the `feature/devtools` branch — raise store defaults, add 4 missing storage test pairs, and write smoke tests for `NetworkTab` and `RequestDetail`.

**Architecture:** Three independent changes: (1) update hardcoded defaults in `devtoolsStore.ts` and the JSDoc in `types/index.ts`; (2) extend the existing `devtoolsStorage.test.ts` with 4 new describe blocks following the established load/save pattern; (3) add two new component smoke test files that mock composables and stub child components.

**Tech Stack:** Vue 3, Vitest, @vue/test-utils, happy-dom, idb-keyval (mocked via `vi.mock`)

---

## File Map

| File | Change |
|------|--------|
| `packages/devtools/src/shared/store/devtoolsStore.ts` | Edit — raise 4 default values (2 in state literal, 2 in `??` fallbacks) |
| `packages/devtools/src/shared/types/index.ts` | Edit — update JSDoc `@property` comments for `maxHistory` and `maxPayloadSize` |
| `packages/devtools/src/shared/storage/devtoolsStorage.test.ts` | Edit — add 4 describe blocks + expand imports |
| `packages/devtools/src/features/network/components/NetworkTab.test.ts` | New — 3 smoke tests |
| `packages/devtools/src/features/network/components/RequestDetail.test.ts` | New — 2 smoke tests |

---

## Task 1: Raise Default Values in devtoolsStore.ts

**Files:**
- Modify: `packages/devtools/src/shared/store/devtoolsStore.ts:20,51-52`

> Note: `devtoolsStore.test.ts` does NOT need changes — the `beforeEach` already uses explicit test values `{ maxHistory: 5, maxPayloadSize: 100 }` that are deliberately small for testing eviction. Those are not production defaults.

- [ ] **Step 1: Update the state literal on line 20**

Open `packages/devtools/src/shared/store/devtoolsStore.ts`. Change:

```ts
config: { maxHistory: 100, maxPayloadSize: 50_000 },
```

to:

```ts
config: { maxHistory: 300, maxPayloadSize: 200_000 },
```

- [ ] **Step 2: Update the `??` fallbacks in `initDevtoolsStore` on lines 51–52**

Change:

```ts
state.config.maxHistory = config.maxHistory ?? 100;
state.config.maxPayloadSize = config.maxPayloadSize ?? 50_000;
```

to:

```ts
state.config.maxHistory = config.maxHistory ?? 300;
state.config.maxPayloadSize = config.maxPayloadSize ?? 200_000;
```

- [ ] **Step 3: Run devtools tests to confirm no regressions**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass (store tests use their own explicit values, not these defaults).

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/store/devtoolsStore.ts
git commit -m "feat(devtools): raise default maxHistory to 300 and maxPayloadSize to 200_000"
```

---

## Task 2: Update JSDoc in types/index.ts

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts:226-227`

- [ ] **Step 1: Update the JSDoc comments**

Open `packages/devtools/src/shared/types/index.ts`. Change:

```ts
 * @property maxHistory Max request records kept in memory; default 100
 * @property maxPayloadSize Max bytes per payload/response before truncation; default 50_000
```

to:

```ts
 * @property maxHistory Max request records kept in memory; default 300
 * @property maxPayloadSize Max bytes per payload/response before truncation; default 200_000
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/shared/types/index.ts
git commit -m "docs(devtools): update DevtoolsOptions JSDoc defaults"
```

---

## Task 3: Add Missing Storage Tests

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.test.ts`

The existing file mocks `idb-keyval` and tests 9 function pairs. We add 4 more pairs following the identical pattern. Defaults confirmed from source:
- `loadNetworkToolbarVisible` → default `true`
- `loadNetworkFilterVisible` → default `true`
- `loadResponseFormat` → default `"json"`
- `loadSplitPayloadWidth` → default `undefined`

- [ ] **Step 1: Expand the import list**

At the top of `devtoolsStorage.test.ts`, the current import ends at `loadPayloadFormat, savePayloadFormat`. Add the 5 missing names:

```ts
import {
    loadPanelPosition,
    savePanelPosition,
    loadPanelSize,
    savePanelSize,
    loadActiveTab,
    saveActiveTab,
    loadPanelHeight,
    savePanelHeight,
    loadPanelMode,
    savePanelMode,
    loadPanelSideWidth,
    savePanelSideWidth,
    loadPayloadFormat,
    savePayloadFormat,
    loadNetworkToolbarVisible,
    saveNetworkToolbarVisible,
    loadNetworkFilterVisible,
    saveNetworkFilterVisible,
    loadResponseFormat,
    saveResponseFormat,
    loadSplitPayloadWidth,
    saveSplitPayloadWidth,
} from "./devtoolsStorage";
```

- [ ] **Step 2: Append the 4 new describe blocks at the end of the file**

```ts
describe("loadNetworkToolbarVisible / saveNetworkToolbarVisible", () => {
    it("loadNetworkToolbarVisible returns true as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadNetworkToolbarVisible();
        expect(get).toHaveBeenCalledWith("vmd:network-toolbar-visible");
        expect(result).toBe(true);
    });

    it("loadNetworkToolbarVisible returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const result = await loadNetworkToolbarVisible();
        expect(result).toBe(false);
    });

    it("saveNetworkToolbarVisible calls set with correct key and value", async () => {
        await saveNetworkToolbarVisible(false);
        expect(set).toHaveBeenCalledWith("vmd:network-toolbar-visible", false);
    });
});

describe("loadNetworkFilterVisible / saveNetworkFilterVisible", () => {
    it("loadNetworkFilterVisible returns true as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadNetworkFilterVisible();
        expect(get).toHaveBeenCalledWith("vmd:network-filter-visible");
        expect(result).toBe(true);
    });

    it("loadNetworkFilterVisible returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const result = await loadNetworkFilterVisible();
        expect(result).toBe(false);
    });

    it("saveNetworkFilterVisible calls set with correct key and value", async () => {
        await saveNetworkFilterVisible(false);
        expect(set).toHaveBeenCalledWith("vmd:network-filter-visible", false);
    });
});

describe("loadResponseFormat / saveResponseFormat", () => {
    it("loadResponseFormat returns \"json\" as default when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadResponseFormat();
        expect(get).toHaveBeenCalledWith("vmd:response-format");
        expect(result).toBe("json");
    });

    it("loadResponseFormat returns saved value", async () => {
        vi.mocked(get).mockResolvedValue("kv");
        const result = await loadResponseFormat();
        expect(result).toBe("kv");
    });

    it("saveResponseFormat calls set with correct key and value", async () => {
        await saveResponseFormat("kv");
        expect(set).toHaveBeenCalledWith("vmd:response-format", "kv");
    });
});

describe("loadSplitPayloadWidth / saveSplitPayloadWidth", () => {
    it("loadSplitPayloadWidth returns undefined when not set", async () => {
        vi.mocked(get).mockResolvedValue(undefined);
        const result = await loadSplitPayloadWidth();
        expect(get).toHaveBeenCalledWith("vmd:split-payload-width");
        expect(result).toBeUndefined();
    });

    it("loadSplitPayloadWidth returns saved value", async () => {
        vi.mocked(get).mockResolvedValue(280);
        const result = await loadSplitPayloadWidth();
        expect(result).toBe(280);
    });

    it("saveSplitPayloadWidth calls set with correct key and value", async () => {
        await saveSplitPayloadWidth(280);
        expect(set).toHaveBeenCalledWith("vmd:split-payload-width", 280);
    });
});
```

- [ ] **Step 3: Run the storage tests to verify all pass**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- devtoolsStorage --run
```

Expected: all existing tests pass + 12 new tests pass (3 per describe block × 4 blocks).

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.test.ts
git commit -m "test(devtools): add missing storage tests for toolbar, filter, response format, split width"
```

---

## Task 4: NetworkTab Smoke Tests

**Files:**
- Create: `packages/devtools/src/features/network/components/NetworkTab.test.ts`

`NetworkTab.vue` uses `useNetworkTab()` and `useNetworkLayout()`. Both are mocked at module level. Child components (`RequestList`, `RequestDetail`, `SelectInput`) are stubbed via `global.stubs` to avoid their own transitive dependencies.

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, computed } from "vue";

vi.mock("../composables/useNetworkTab", () => ({
    useNetworkTab: vi.fn(() => ({
        urlFilter: ref(""),
        statusFilter: ref("all"),
        instanceFilter: ref("all"),
        filteredRequests: computed(() => []),
        clearFilters: vi.fn(),
        selectedRequest: computed(() => null),
        selectedRequestId: ref(null),
        viewMode: ref("split"),
        payloadFormat: ref("json"),
        responseFormat: ref("json"),
        selectRequest: vi.fn(),
        setViewMode: vi.fn(),
        togglePayloadFormat: vi.fn(),
        toggleResponseFormat: vi.fn(),
        instances: computed(() => new Map()),
    })),
}));

vi.mock("../composables/useNetworkLayout", () => ({
    useNetworkLayout: vi.fn(() => ({
        toolbarVisible: ref(true),
        filterVisible: ref(true),
        settingsOpen: ref(false),
        toggleToolbar: vi.fn(),
        toggleFilter: vi.fn(),
        toggleSettings: vi.fn(),
        closeSettings: vi.fn(),
    })),
}));

vi.mock("../../../shared/store/devtoolsStore", () => ({
    clearRequests: vi.fn(),
}));

import NetworkTab from "./NetworkTab.vue";

const stubs = {
    RequestList: { template: "<div />" },
    RequestDetail: { template: "<div />" },
    SelectInput: { template: "<div />" },
    Teleport: true,
    Transition: true,
};

describe("NetworkTab", () => {
    it("mounts without crashing", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.exists()).toBe(true);
    });

    it("renders the .network-tab container", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.find(".network-tab").exists()).toBe(true);
    });

    it("renders 'No requests.' when filteredRequests is empty", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.text()).toContain("No requests.");
    });

    it("renders the toolbar when toolbarVisible is true", () => {
        const wrapper = mount(NetworkTab, { global: { stubs } });
        expect(wrapper.find(".toolbar").exists()).toBe(true);
    });
});
```

- [ ] **Step 2: Run the new test to verify it passes**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- NetworkTab --run
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/components/NetworkTab.test.ts
git commit -m "test(devtools): add NetworkTab smoke tests"
```

---

## Task 5: RequestDetail Smoke Tests

**Files:**
- Create: `packages/devtools/src/features/network/components/RequestDetail.test.ts`

`RequestDetail.vue` takes a `request` prop and an optional `instanceOptions` prop. It renders child components (`DetailHeader`, `DetailTabs`, `SplitView`, `DataPane`, `PayloadPane`) which are stubbed. No composables or store calls — pure props-driven presentation component.

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { RequestRecord } from "../../../shared/types/index";
import RequestDetail from "./RequestDetail.vue";

const stubs = {
    DetailHeader: { template: "<div />" },
    DetailTabs: { template: "<div />" },
    SplitView: { template: "<div />" },
    DataPane: { template: "<div />" },
    PayloadPane: { template: "<div />" },
};

const mockRequest: RequestRecord = {
    id: "r-1",
    instanceId: null,
    url: "/api/users",
    method: "GET",
    startedAt: Date.now(),
    duration: 42,
    status: "success",
    statusCode: 200,
    requestHeaders: { "content-type": "application/json" },
    payload: null,
    queryParams: null,
    response: { users: [] },
    error: null,
    truncated: false,
};

describe("RequestDetail", () => {
    it("mounts without crashing when a request is provided", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        expect(wrapper.exists()).toBe(true);
    });

    it("renders the .request-detail container", () => {
        const wrapper = mount(RequestDetail, {
            props: { request: mockRequest },
            global: { stubs },
        });
        expect(wrapper.find(".request-detail").exists()).toBe(true);
    });

    it("mounts without crashing when instanceOptions is provided", () => {
        const wrapper = mount(RequestDetail, {
            props: {
                request: mockRequest,
                instanceOptions: {
                    authMode: "default",
                    cache: undefined,
                    retry: false,
                    poll: 0,
                    immediate: true,
                    lazy: false,
                },
            },
            global: { stubs },
        });
        expect(wrapper.exists()).toBe(true);
    });
});
```

- [ ] **Step 2: Run the new test to verify it passes**

```bash
pnpm --filter @ametie/vue-muza-devtools test -- RequestDetail --run
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/components/RequestDetail.test.ts
git commit -m "test(devtools): add RequestDetail smoke tests"
```

---

## Task 6: Full Suite Verification

- [ ] **Step 1: Run the full devtools test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Run the use-api test suite**

```bash
pnpm --filter @ametie/vue-muza-use test --run
```

Expected: all tests pass, 0 failures.
