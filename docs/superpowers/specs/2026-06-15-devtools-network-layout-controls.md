# DevTools Network Layout Controls — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⋮ settings menu to the TabBar (between mode switcher and ✕) that lets users toggle Network tab toolbar and filter bar visibility; also persist the SplitView payload-pane width — all state saved to IndexedDB.

**Architecture:** A new `useNetworkLayout` composable owns toolbar/filter visibility state and IndexedDB persistence. `TabBar` gains a ⋮ button that emits the open-menu event; the menu itself renders inside `NetworkTab` (since it owns the layout state). `SplitView` gets load/save wired to an existing storage helper.

**Tech Stack:** Vue 3 SFCs, idb-keyval, existing `devtoolsStorage.ts` pattern.

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/devtools/src/shared/storage/devtoolsStorage.ts` |
| Create | `packages/devtools/src/features/network/composables/useNetworkLayout.ts` |
| Modify | `packages/devtools/src/features/panel/components/TabBar.vue` |
| Modify | `packages/devtools/src/features/network/components/NetworkTab.vue` |
| Modify | `packages/devtools/src/features/network/components/SplitView.vue` |
| Modify | `packages/devtools/src/shared/types/index.ts` |

---

## Task 1: Storage helpers for network layout + split width

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`

- [ ] **Step 1: Add 3 new keys to the KEYS constant**

```ts
const KEYS = {
    // ...existing keys...
    networkToolbarVisible: "vmd:network-toolbar-visible",
    networkFilterVisible: "vmd:network-filter-visible",
    splitPayloadWidth: "vmd:split-payload-width",
} as const;
```

- [ ] **Step 2: Add 6 new storage functions after existing ones**

```ts
export async function loadNetworkToolbarVisible(): Promise<boolean> {
    return (await get<boolean>(KEYS.networkToolbarVisible)) ?? true;
}
export async function saveNetworkToolbarVisible(value: boolean): Promise<void> {
    return set(KEYS.networkToolbarVisible, value);
}

export async function loadNetworkFilterVisible(): Promise<boolean> {
    return (await get<boolean>(KEYS.networkFilterVisible)) ?? true;
}
export async function saveNetworkFilterVisible(value: boolean): Promise<void> {
    return set(KEYS.networkFilterVisible, value);
}

export async function loadSplitPayloadWidth(): Promise<number | undefined> {
    return get<number>(KEYS.splitPayloadWidth);
}
export async function saveSplitPayloadWidth(width: number): Promise<void> {
    return set(KEYS.splitPayloadWidth, width);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.ts
git commit -m "feat(devtools): add storage helpers for network layout visibility and split width"
```

---

## Task 2: `useNetworkLayout` composable

**Files:**
- Create: `packages/devtools/src/features/network/composables/useNetworkLayout.ts`

- [ ] **Step 1: Create the file**

```ts
import { ref, onMounted } from "vue";
import type { Ref } from "vue";
import {
    loadNetworkToolbarVisible, saveNetworkToolbarVisible,
    loadNetworkFilterVisible, saveNetworkFilterVisible,
} from "../../../shared/storage/devtoolsStorage";

export interface UseNetworkLayoutReturn {
    /** Whether the toolbar row (filter URL, instance select, buttons) is visible. */
    toolbarVisible: Ref<boolean>;
    /** Whether the filter-pills bar is visible. */
    filterVisible: Ref<boolean>;
    /** Toggle toolbar visibility and persist. */
    toggleToolbar: () => void;
    /** Toggle filter bar visibility and persist. */
    toggleFilter: () => void;
}

export function useNetworkLayout(): UseNetworkLayoutReturn {
    const toolbarVisible = ref(true);
    const filterVisible = ref(true);

    onMounted(async () => {
        const [toolbar, filter] = await Promise.all([
            loadNetworkToolbarVisible(),
            loadNetworkFilterVisible(),
        ]);
        toolbarVisible.value = toolbar;
        filterVisible.value = filter;
    });

    function toggleToolbar(): void {
        toolbarVisible.value = !toolbarVisible.value;
        saveNetworkToolbarVisible(toolbarVisible.value);
    }

    function toggleFilter(): void {
        filterVisible.value = !filterVisible.value;
        saveNetworkFilterVisible(filterVisible.value);
    }

    return { toolbarVisible, filterVisible, toggleToolbar, toggleFilter };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/features/network/composables/useNetworkLayout.ts
git commit -m "feat(devtools): add useNetworkLayout composable for toolbar/filter visibility"
```

---

## Task 3: ⋮ button in TabBar

The ⋮ button sits between the `.mode-divider` and `.close-btn`. It emits `"settings"` when clicked. The menu itself lives in `NetworkTab` — `TabBar` only provides the trigger.

**Files:**
- Modify: `packages/devtools/src/features/panel/components/TabBar.vue`

- [ ] **Step 1: Add `"settings"` to the emits**

```ts
defineEmits<{
    close: [];
    "update:panelMode": [PanelMode];
    settings: [];
}>();
```

- [ ] **Step 2: Add the ⋮ button in the template between `.mode-divider` and `.close-btn`**

```html
<div class="mode-divider" />

<button class="settings-btn" title="Layout settings" @click="$emit('settings')">
    <span class="dots"><span /><span /><span /></span>
</button>

<button class="close-btn" title="Close devtools" @click="$emit('close')">
```

- [ ] **Step 3: Add styles**

```css
.settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
}
.settings-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-secondary);
}
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

- [ ] **Step 4: Wire the emit in FloatingPanel and SidePanel — both pass `@settings` through**

In `FloatingPanel.vue`, add to `<TabBar>`:
```html
@settings="settingsOpen = !settingsOpen"
```

In `SidePanel.vue`, same:
```html
@settings="settingsOpen = !settingsOpen"
```

Note: `settingsOpen` is not used in these wrappers — the event bubbles up. The menu lives in `NetworkTab`. Skip this step — `TabBar` emits `settings`, `NetworkTab` listens via a shared ref (see Task 4).

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/panel/components/TabBar.vue
git commit -m "feat(devtools): add settings ⋮ button to TabBar"
```

---

## Task 4: Settings menu in NetworkTab

The ⋮ button in `TabBar` emits `"settings"`. Since `NetworkTab` is the content pane (not a direct child of `TabBar`), we use a module-level singleton ref `_networkSettingsOpen` in `useNetworkLayout` to communicate the toggle without prop drilling.

**Files:**
- Modify: `packages/devtools/src/features/network/composables/useNetworkLayout.ts`
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue`
- Modify: `packages/devtools/src/features/panel/components/SidePanel.vue`
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

- [ ] **Step 1: Add `_settingsOpen` singleton and `openSettings` to `useNetworkLayout`**

```ts
// Module-level singleton — shared between TabBar trigger and NetworkTab menu
const _settingsOpen = ref(false);

export interface UseNetworkLayoutReturn {
    toolbarVisible: Ref<boolean>;
    filterVisible: Ref<boolean>;
    settingsOpen: Ref<boolean>;
    toggleToolbar: () => void;
    toggleFilter: () => void;
    toggleSettings: () => void;
}

export function useNetworkLayout(): UseNetworkLayoutReturn {
    // ...existing code...

    function toggleSettings(): void {
        _settingsOpen.value = !_settingsOpen.value;
    }

    return { toolbarVisible, filterVisible, settingsOpen: _settingsOpen, toggleToolbar, toggleFilter, toggleSettings };
}
```

- [ ] **Step 2: Wire `@settings="toggleSettings"` in `FloatingPanel.vue`**

```ts
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
const { toggleSettings } = useNetworkLayout();
```

```html
<TabBar
    ...
    @settings="toggleSettings"
/>
```

- [ ] **Step 3: Same in `SidePanel.vue`**

```ts
import { useNetworkLayout } from "../../network/composables/useNetworkLayout";
const { toggleSettings } = useNetworkLayout();
```

```html
<TabBar
    ...
    @settings="toggleSettings"
/>
```

- [ ] **Step 4: Consume in `NetworkTab.vue` — add menu overlay and hide/show sections**

Add to `<script setup>`:
```ts
import { useNetworkLayout } from "../composables/useNetworkLayout";
const { toolbarVisible, filterVisible, settingsOpen, toggleToolbar, toggleFilter } = useNetworkLayout();
```

Wrap toolbar with `v-show`:
```html
<div v-show="toolbarVisible" class="toolbar">
    ...
</div>
```

Wrap filter bar with `v-show`:
```html
<div v-show="filterVisible" class="filter-bar">
    ...
</div>
```

Add settings menu overlay (inside `.network-tab`, after filter bar):
```html
<!-- Settings menu — shown when ⋮ is clicked in TabBar -->
<Teleport to="body">
    <div
        v-if="settingsOpen"
        class="settings-backdrop"
        @click="settingsOpen = false"
    />
</Teleport>
<div v-if="settingsOpen" class="settings-menu">
    <button class="settings-item" @click="toggleToolbar">
        <span class="settings-check" :class="{ 'settings-check--on': toolbarVisible }">
            <svg v-if="toolbarVisible" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
        </span>
        Toolbar
    </button>
    <button class="settings-item" @click="toggleFilter">
        <span class="settings-check" :class="{ 'settings-check--on': filterVisible }">
            <svg v-if="filterVisible" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
        </span>
        Filter bar
    </button>
</div>
```

- [ ] **Step 5: Add styles to `NetworkTab.vue`**

```css
.settings-menu {
    position: absolute;
    right: 8px;
    top: 38px; /* below tab bar */
    z-index: 100;
    background: var(--dt-nav);
    border: 1px solid var(--dt-border);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    min-width: 160px;
}
.settings-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--dt-foreground);
    font-size: 12px;
    cursor: pointer;
    border-radius: 5px;
    text-align: left;
}
.settings-item:hover { background: var(--dt-surface-raised); }
.settings-check {
    width: 14px;
    height: 14px;
    border: 1px solid var(--dt-border-strong);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.settings-check--on {
    background: var(--dt-primary);
    border-color: var(--dt-primary);
    color: white;
}
/* network-tab needs position:relative for the menu */
.network-tab { position: relative; }
```

Also add a `settings-backdrop` style:
```css
.settings-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
}
```

The `.settings-backdrop` goes in a `<Teleport to="body">` so it covers the full viewport behind the menu. The menu itself stays in `.network-tab` with `z-index: 100`.

- [ ] **Step 6: Close menu when clicking outside — handled by the backdrop. Also close when a toggle is clicked (menu stays open to allow multiple changes). Add explicit close button or press Escape.**

Add `@keydown.escape` on the menu:
```html
<div v-if="settingsOpen" class="settings-menu" @keydown.escape="settingsOpen = false">
```

- [ ] **Step 7: Commit**

```bash
git add packages/devtools/src/features/network/composables/useNetworkLayout.ts \
        packages/devtools/src/features/panel/components/FloatingPanel.vue \
        packages/devtools/src/features/panel/components/SidePanel.vue \
        packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "feat(devtools): network layout settings menu with toolbar/filter toggle"
```

---

## Task 5: Persist SplitView payload-pane width

**Files:**
- Modify: `packages/devtools/src/features/network/components/SplitView.vue`

- [ ] **Step 1: Import storage helpers and `onMounted`**

```ts
import { ref, computed, watch, onMounted, onScopeDispose } from "vue";
import { loadSplitPayloadWidth, saveSplitPayloadWidth } from "../../../shared/storage/devtoolsStorage";
```

- [ ] **Step 2: Load saved width on mount**

```ts
onMounted(async () => {
    const saved = await loadSplitPayloadWidth();
    if (saved !== undefined) primarySize.value = saved;
});
```

- [ ] **Step 3: Save width after horizontal drag ends (row mode only)**

In the `onUp` function inside the `else` branch of `startSplitResize` (the row/horizontal branch):
```ts
function onUp(): void {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    splitDragCleanup = null;
    saveSplitPayloadWidth(primarySize.value!);
}
```

Do not save in stacked/vertical mode — vertical position is less useful to persist and conflicts with the same key when switching modes.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/network/components/SplitView.vue
git commit -m "feat(devtools): persist split payload pane width to IndexedDB"
```

---

## Task 6: Tests

**Files:**
- Create: `packages/devtools/src/features/network/composables/__tests__/useNetworkLayout.test.ts`

- [ ] **Step 1: Create test file**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useNetworkLayout } from "../useNetworkLayout";

vi.mock("idb-keyval", () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
}));

import { get, set } from "idb-keyval";

function withSetup<T>(composable: () => T): [T, ReturnType<typeof mount>] {
    let result!: T;
    const wrapper = mount(defineComponent({
        setup() { result = composable(); return () => null; },
    }));
    return [result, wrapper];
}

describe("useNetworkLayout", () => {
    beforeEach(() => {
        vi.mocked(get).mockResolvedValue(undefined);
        vi.mocked(set).mockResolvedValue(undefined);
    });

    it("defaults to both visible", async () => {
        const [{ toolbarVisible, filterVisible }] = withSetup(useNetworkLayout);
        await flushPromises();
        expect(toolbarVisible.value).toBe(true);
        expect(filterVisible.value).toBe(true);
    });

    it("loads persisted false values from IndexedDB", async () => {
        vi.mocked(get).mockResolvedValue(false);
        const [{ toolbarVisible }] = withSetup(useNetworkLayout);
        await flushPromises();
        expect(toolbarVisible.value).toBe(false);
    });

    it("toggleToolbar flips value and saves", async () => {
        const [{ toolbarVisible, toggleToolbar }] = withSetup(useNetworkLayout);
        await flushPromises();
        toggleToolbar();
        expect(toolbarVisible.value).toBe(false);
        expect(set).toHaveBeenCalledWith("vmd:network-toolbar-visible", false);
    });

    it("toggleFilter flips value and saves", async () => {
        const [{ filterVisible, toggleFilter }] = withSetup(useNetworkLayout);
        await flushPromises();
        toggleFilter();
        expect(filterVisible.value).toBe(false);
        expect(set).toHaveBeenCalledWith("vmd:network-filter-visible", false);
    });

    it("toggleSettings flips settingsOpen", async () => {
        const [{ settingsOpen, toggleSettings }] = withSetup(useNetworkLayout);
        expect(settingsOpen.value).toBe(false);
        toggleSettings();
        expect(settingsOpen.value).toBe(true);
        toggleSettings();
        expect(settingsOpen.value).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/composables/__tests__/useNetworkLayout.test.ts
git commit -m "test(devtools): add useNetworkLayout composable tests"
```

---

## Task 7: Newest requests on top

New requests should appear at the top of the list so the most recent activity is immediately visible without scrolling.

**Files:**
- Modify: `packages/devtools/src/features/network/composables/useNetworkFilter.ts`

- [ ] **Step 1: Reverse the filtered array in the computed**

Change the `filteredRequests` computed from:

```ts
const filteredRequests = computed((): ReadonlyArray<RequestRecord> => {
    return requests.value.filter((r) => {
        if (urlFilter.value && !r.url.toLowerCase().includes(urlFilter.value.toLowerCase())) return false;
        if (statusFilter.value !== "all" && r.status !== statusFilter.value) return false;
        if (instanceFilter.value !== "all" && r.instanceId !== instanceFilter.value) return false;
        return true;
    });
});
```

To:

```ts
const filteredRequests = computed((): ReadonlyArray<RequestRecord> => {
    return requests.value.filter((r) => {
        if (urlFilter.value && !r.url.toLowerCase().includes(urlFilter.value.toLowerCase())) return false;
        if (statusFilter.value !== "all" && r.status !== statusFilter.value) return false;
        if (instanceFilter.value !== "all" && r.instanceId !== instanceFilter.value) return false;
        return true;
    }).reverse();
});
```

`.filter()` returns a new array, so `.reverse()` mutates only that copy — the underlying `requests` store is untouched.

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/composables/useNetworkFilter.ts
git commit -m "feat(devtools): show newest network requests at the top of the list"
```

---

## Self-Review Checklist

- [x] No TBDs or placeholders
- [x] All file paths exact
- [x] Storage keys consistent across tasks (vmd:network-toolbar-visible, vmd:network-filter-visible, vmd:split-payload-width)
- [x] `_settingsOpen` singleton pattern matches `_panelMode` pattern already in codebase
- [x] Backdrop uses Teleport to avoid z-index conflicts with panel content
- [x] Split width only saved in row mode (avoids stacked-mode height pollution)
- [x] Tests cover default, load, toggle, and settings open/close
- [x] `.reverse()` applied to copy from `.filter()`, not to the store array directly
