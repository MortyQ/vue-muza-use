# Devtools UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the devtools panel UI — replace the floating panel with a bottom drawer, add a pill-style launcher with the M icon, rebuild the Network tab with Nuxt-style request rows, drag-resizable split panes, feature badges, and proper JSON/KV viewers.

**Architecture:** Bottom-up component replacement. Foundation first (tokens → composable → panel shell), then Network tab atoms up (KvViewer → DataPane → SplitView → DetailHeader/Tabs → RequestDetail). Existing composables and store are untouched; only component files and the shared types file change. The `PayloadView.vue` and `ResponseView.vue` are superseded by `DataPane.vue` but left in place to avoid breakage.

**Tech Stack:** Vue 3 SFC with `<style scoped>`, CSS custom properties (oklch tokens), `@iconify/vue` (already installed), `@tanstack/vue-virtual` (existing, row height estimate updated), `idb-keyval` (existing).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/style.css` | Add oklch CSS custom properties |
| Modify | `src/shared/storage/devtoolsStorage.ts` | Add `loadPanelHeight` / `savePanelHeight` |
| Modify | `src/features/panel/composables/useFloatingPanel.ts` | Height-only bottom drawer |
| Modify | `src/features/panel/composables/useFloatingPanel.test.ts` | Update tests to new API |
| Create | `src/shared/components/MIcon.vue` | M-icon SVG (two-tone inverted Vue V) |
| Modify | `src/features/panel/components/FloatingPanel.vue` | Bottom drawer layout + pill launcher |
| Modify | `src/features/panel/components/TabBar.vue` | Horizontal top navigation |
| Modify | `src/shared/types/index.ts` | Add `debounce?` and `batch?` to `DevtoolsInstanceOptions` |
| Modify | `src/features/network/components/RequestList.vue` | Pass instance options to RequestRow |
| Modify | `src/features/network/components/RequestRow.vue` | Feature badges + Nuxt-style two-line layout |
| Modify | `src/features/network/components/NetworkTab.vue` | Toolbar + filter bar + drag split |
| Modify | `src/shared/components/JsonViewer.vue` | `white-space: pre` + oklch colors |
| Create | `src/features/network/components/KvViewer.vue` | Flat KV table with nested-object badges |
| Create | `src/features/network/components/DataPane.vue` | Reusable pane: title + KV toggle + copy + body |
| Create | `src/features/network/components/SplitView.vue` | Two DataPanes + drag handle |
| Create | `src/features/network/components/DetailHeader.vue` | Status + method + url + meta + close |
| Create | `src/features/network/components/DetailTabs.vue` | Split / Payload / Response / Headers tabs |
| Modify | `src/features/network/components/RequestDetail.vue` | Wire all new components |

---

## Task 1: Design Tokens

**Files:**
- Modify: `packages/devtools/src/style.css`

- [ ] **Step 1: Add oklch CSS custom properties**

Replace the entire file content:

```css
@import "tailwindcss" prefix(vmd);

:root {
  --dt-background:           oklch(16% 0.025 270);
  --dt-surface-sunken:       oklch(13% 0.022 270);
  --dt-surface:              oklch(20% 0.025 270);
  --dt-surface-raised:       oklch(24% 0.025 270);
  --dt-surface-active:       oklch(27% 0.025 270);
  --dt-primary:              oklch(65% 0.25 280);
  --dt-primary-subtle:       oklch(28% 0.10 280);
  --dt-foreground:           oklch(93% 0.006 280);
  --dt-foreground-secondary: oklch(73% 0.010 280);
  --dt-foreground-muted:     oklch(52% 0.007 280);
  --dt-foreground-subtle:    oklch(40% 0.005 280);
  --dt-border-subtle:        oklch(24% 0.020 270);
  --dt-border:               oklch(30% 0.022 270);
  --dt-border-strong:        oklch(40% 0.018 270);
  --dt-vue-green:            oklch(63% 0.17 145);
  --dt-vue-green-subtle:     oklch(24% 0.07 145);
  --dt-nav:                  oklch(13% 0.022 270);
  --dt-danger:               oklch(63% 0.22 25);
  --dt-danger-subtle:        oklch(24% 0.08 25);
  --dt-warning:              oklch(74% 0.17 75);
  --dt-warning-subtle:       oklch(24% 0.07 75);
  --dt-info:                 oklch(66% 0.18 240);
  --dt-info-subtle:          oklch(24% 0.07 240);
  --dt-success:              oklch(63% 0.17 145);
  --dt-success-subtle:       oklch(24% 0.07 145);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/style.css
git commit -m "feat(devtools): add oklch design token CSS custom properties"
```

---

## Task 2: Storage — Panel Height

**Files:**
- Modify: `packages/devtools/src/shared/storage/devtoolsStorage.ts`

- [ ] **Step 1: Add `panelHeight` key and two functions**

Add to the `KEYS` object and append two functions at the end of the file:

```ts
// In KEYS object, add:
panelHeight: "vmd:panel-height",
```

```ts
/**
 * Loads the saved panel height from IndexedDB. Returns undefined if not previously saved.
 */
export async function loadPanelHeight(): Promise<number | undefined> {
    return get<number>(KEYS.panelHeight);
}

/**
 * Saves the panel height to IndexedDB.
 */
export async function savePanelHeight(height: number): Promise<void> {
    return set(KEYS.panelHeight, height);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/shared/storage/devtoolsStorage.ts
git commit -m "feat(devtools): add loadPanelHeight/savePanelHeight storage helpers"
```

---

## Task 3: useFloatingPanel — Bottom Drawer

**Files:**
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.ts`
- Modify: `packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts`

- [ ] **Step 1: Write updated failing tests first**

Replace the entire `useFloatingPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, nextTick } from "vue";

vi.mock("../../../shared/storage/devtoolsStorage", () => ({
    loadPanelHeight: vi.fn().mockResolvedValue(undefined),
    savePanelHeight: vi.fn().mockResolvedValue(undefined),
}));

import { loadPanelHeight, savePanelHeight } from "../../../shared/storage/devtoolsStorage";
import { useFloatingPanel } from "./useFloatingPanel";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;
    const app = createApp({ setup() { result = composable(); return () => null; } });
    app.mount(document.createElement("div"));
    return { result, unmount: () => app.unmount() };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("initial state", () => {
    it("starts with height 360 and closed", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        expect(result.height.value).toBe(360);
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("storage hydration", () => {
    it("loads saved height on mount", async () => {
        vi.mocked(loadPanelHeight).mockResolvedValue(500);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.height.value).toBe(500);
        unmount();
    });

    it("ignores undefined saved height", async () => {
        vi.mocked(loadPanelHeight).mockResolvedValue(undefined);
        const { result, unmount } = withSetup(() => useFloatingPanel());
        await nextTick();
        await nextTick();
        expect(result.height.value).toBe(360);
        unmount();
    });
});

describe("toggle / close", () => {
    it("toggle flips isOpen", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.toggle();
        expect(result.isOpen.value).toBe(true);
        result.toggle();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });

    it("close sets isOpen to false when open", () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.toggle();
        result.close();
        expect(result.isOpen.value).toBe(false);
        unmount();
    });
});

describe("height resize", () => {
    it("dragging up increases height", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 360;

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 300 }));
        await nextTick();

        expect(result.height.value).toBe(460);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("dragging down decreases height", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 400;

        result.startResizeHeight({ clientY: 300, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 350 }));
        await nextTick();

        expect(result.height.value).toBe(350);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("height cannot go below MIN_HEIGHT (200)", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 220;

        result.startResizeHeight({ clientY: 100, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 500 }));
        await nextTick();

        expect(result.height.value).toBe(200);
        window.dispatchEvent(new MouseEvent("mouseup"));
        unmount();
    });

    it("saves height to storage on mouseup", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 350 }));
        window.dispatchEvent(new MouseEvent("mouseup"));
        await nextTick();

        expect(savePanelHeight).toHaveBeenCalledWith(450);
        unmount();
    });

    it("mouseup stops resize — further mousemove has no effect", async () => {
        const { result, unmount } = withSetup(() => useFloatingPanel());
        result.height.value = 360;

        result.startResizeHeight({ clientY: 400, preventDefault: vi.fn() } as unknown as MouseEvent);
        window.dispatchEvent(new MouseEvent("mouseup"));
        window.dispatchEvent(Object.assign(new MouseEvent("mousemove"), { clientY: 100 }));
        await nextTick();

        expect(result.height.value).toBe(360);
        unmount();
    });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: failures on `height`, `startResizeHeight`, `loadPanelHeight` — the new API doesn't exist yet.

- [ ] **Step 3: Implement the new composable**

Replace the entire `useFloatingPanel.ts`:

```ts
import { ref, onMounted, onScopeDispose } from "vue";
import type { Ref } from "vue";
import { loadPanelHeight, savePanelHeight } from "../../../shared/storage/devtoolsStorage";

/**
 * Return type for the useFloatingPanel composable.
 */
export interface UseFloatingPanelReturn {
    /** Panel height in pixels. */
    height: Ref<number>;
    /** Whether the panel is currently visible. */
    isOpen: Ref<boolean>;
    /** Begin top-edge drag to resize panel height. Attach to the resize handle's mousedown. */
    startResizeHeight: (e: MouseEvent) => void;
    /** Toggle panel visibility. */
    toggle: () => void;
    /** Hide the panel. */
    close: () => void;
}

const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;

/**
 * Composable for the bottom-drawer devtools panel.
 * Manages open/close state and height-only resize, persisted to IndexedDB.
 *
 * @example
 * ```ts
 * const { height, isOpen, startResizeHeight, toggle, close } = useFloatingPanel();
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
    const height = ref(DEFAULT_HEIGHT);
    const isOpen = ref(false);

    onMounted(async () => {
        const saved = await loadPanelHeight();
        if (saved !== undefined) height.value = saved;
    });

    function toggle(): void { isOpen.value = !isOpen.value; }
    function close(): void { isOpen.value = false; }

    let resizing = false;

    function startResizeHeight(e: MouseEvent): void {
        const startY = e.clientY;
        const startH = height.value;
        resizing = true;

        function onMove(ev: MouseEvent): void {
            if (!resizing) return;
            const maxH = Math.floor(window.innerHeight * 0.8);
            height.value = Math.max(MIN_HEIGHT, Math.min(startH + (startY - ev.clientY), maxH));
        }

        function onUp(): void {
            resizing = false;
            savePanelHeight(height.value);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        e.preventDefault();
    }

    onScopeDispose(() => { /* onUp closures self-clean */ });

    return { height, isOpen, startResizeHeight, toggle, close };
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all `useFloatingPanel` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools/src/features/panel/composables/useFloatingPanel.ts \
        packages/devtools/src/features/panel/composables/useFloatingPanel.test.ts
git commit -m "feat(devtools): refactor useFloatingPanel to height-only bottom drawer"
```

---

## Task 4: MIcon Component

**Files:**
- Create: `packages/devtools/src/shared/components/MIcon.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
defineProps<{
    width?: number | string;
    height?: number | string;
}>();
</script>

<template>
    <svg
        :width="width ?? 22"
        :height="height ?? 10"
        viewBox="0 0 80 36"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <!-- Left ∧ outer (62% opacity) -->
        <path d="M0,36 L20,0 L40,36 Z" fill="rgba(255,255,255,0.62)" />
        <!-- Left ∧ inner (full white) -->
        <path d="M8,36 L20,16 L32,36 Z" fill="white" />
        <!-- Right ∧ outer (62% opacity) -->
        <path d="M40,36 L60,0 L80,36 Z" fill="rgba(255,255,255,0.62)" />
        <!-- Right ∧ inner (full white) -->
        <path d="M48,36 L60,16 L72,36 Z" fill="white" />
    </svg>
</template>
```

- [ ] **Step 2: Verify in playground**

Run `cd packages/playground && pnpm dev`, open devtools panel, confirm the icon renders.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/shared/components/MIcon.vue
git commit -m "feat(devtools): add MIcon SVG component (two-tone inverted Vue V)"
```

---

## Task 5: Bottom Drawer Panel + Horizontal TabBar

**Files:**
- Modify: `packages/devtools/src/features/panel/components/FloatingPanel.vue`
- Modify: `packages/devtools/src/features/panel/components/TabBar.vue`

- [ ] **Step 1: Rewrite FloatingPanel.vue**

```vue
<script setup lang="ts">
import { useFloatingPanel } from "../composables/useFloatingPanel";
import { useTabManager } from "../composables/useTabManager";
import TabBar from "./TabBar.vue";
import MIcon from "../../../shared/components/MIcon.vue";

const { height, isOpen, startResizeHeight, toggle, close } = useFloatingPanel();
const { registeredTabs, activeTabId, activeTab, setActiveTab } = useTabManager();
</script>

<template>
    <!-- Launcher pill — fixed bottom-right, shown when panel is closed -->
    <button
        v-if="!isOpen"
        data-vmd-launcher
        class="launcher-pill"
        title="Open vue-muza devtools"
        @click="toggle"
    >
        <MIcon :width="22" :height="10" />
        <span>vue-muza</span>
    </button>

    <!-- Bottom drawer panel -->
    <div
        v-else
        data-vmd-panel
        class="devtools-panel"
        :style="{ height: `${height}px` }"
    >
        <!-- Top resize handle (drag up/down to resize) -->
        <div class="resize-handle" @mousedown="startResizeHeight" />

        <!-- Horizontal tab bar -->
        <TabBar
            :tabs="registeredTabs"
            :active-tab-id="activeTabId ?? null"
            :on-select-tab="setActiveTab"
            @close="close"
        />

        <!-- Active tab content -->
        <div class="panel-content">
            <component :is="activeTab?.component" v-if="activeTab" />
        </div>
    </div>
</template>

<style scoped>
.launcher-pill {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 10px;
    background: var(--dt-primary);
    border-radius: 99px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px oklch(65% 0.25 280 / 0.35);
    transition: transform 0.15s, box-shadow 0.15s;
    pointer-events: auto;
}
.launcher-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(65% 0.25 280 / 0.5);
}

.devtools-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9998;
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

.resize-handle {
    height: 4px;
    flex-shrink: 0;
    cursor: row-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
}
.resize-handle:hover { background: var(--dt-primary); }

.panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
</style>
```

- [ ] **Step 2: Rewrite TabBar.vue**

```vue
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DevtoolsTab } from "../../../shared/types/index";

defineProps<{
    tabs: readonly DevtoolsTab[];
    activeTabId: string | null;
    onSelectTab: (id: string) => void;
}>();
defineEmits<{ close: [] }>();
</script>

<template>
    <div class="tab-bar">
        <div class="tab-list">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                data-vmd-tab
                class="tab-btn"
                :class="tab.id === activeTabId ? 'tab-btn--active' : 'tab-btn--inactive'"
                @click="onSelectTab(tab.id)"
            >
                <Icon
                    v-if="typeof tab.icon === 'string'"
                    :icon="tab.icon"
                    width="13"
                    height="13"
                />
                <span>{{ tab.label }}</span>
            </button>
        </div>
        <button class="close-btn" title="Close devtools" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.tab-bar {
    display: flex;
    align-items: center;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.tab-list {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 6px;
    gap: 2px;
}
.tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
}
.tab-btn--active {
    color: var(--dt-vue-green);
    border-bottom-color: var(--dt-vue-green);
}
.tab-btn--inactive {
    color: var(--dt-foreground-muted);
}
.tab-btn--inactive:hover {
    color: var(--dt-foreground-secondary);
    background: var(--dt-surface);
}
.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
}
.close-btn:hover {
    background: var(--dt-surface-raised);
    color: var(--dt-foreground);
}
</style>
```

- [ ] **Step 3: Verify in playground**

Open playground devtools. Confirm: pill launcher bottom-right with M icon + "vue-muza" text, click opens bottom drawer, tabs show horizontally at top, close button (✕) works, drag top resize handle changes height.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/panel/components/FloatingPanel.vue \
        packages/devtools/src/features/panel/components/TabBar.vue
git commit -m "feat(devtools): bottom drawer panel with pill launcher and horizontal tabs"
```

---

## Task 6: Feature Flag Types

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts`

- [ ] **Step 1: Add `debounce` and `batch` to `DevtoolsInstanceOptions`**

Find the `DevtoolsInstanceOptions` interface and add two optional fields:

```ts
export interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: CacheOptions | string | undefined;
    retry: boolean | number;
    poll: number;
    immediate: boolean;
    lazy: boolean;
    /** Debounce delay in milliseconds; undefined if debouncing is not configured. */
    debounce?: number;
    /** True if this instance belongs to a useApiBatch call. */
    batch?: boolean;
}
```

- [ ] **Step 2: Run tests — expect no new failures**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all existing tests still pass (additive change only).

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/shared/types/index.ts
git commit -m "feat(devtools): add debounce and batch fields to DevtoolsInstanceOptions"
```

---

## Task 7: RequestRow — Feature Badges

**Files:**
- Modify: `packages/devtools/src/features/network/components/RequestList.vue`
- Modify: `packages/devtools/src/features/network/components/RequestRow.vue`

- [ ] **Step 1: Update RequestList.vue to pass instance options**

Replace the entire file:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { RequestRecord, DevtoolsInstanceOptions } from "../../../shared/types/index";
import { useDevtoolsStore } from "../../../shared/composables/useDevtoolsStore";
import RequestRow from "./RequestRow.vue";

const props = defineProps<{
    requests: ReadonlyArray<RequestRecord>;
    activeRequestId: string | null;
}>();
defineEmits<{ (e: "select", id: string): void }>();

const { instances } = useDevtoolsStore();

function getInstanceOptions(instanceId: string | null): DevtoolsInstanceOptions | undefined {
    if (!instanceId) return undefined;
    return instances.value.get(instanceId)?.options;
}

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

<template>
    <div ref="parentRef" class="flex-1 overflow-auto" style="background: var(--dt-surface-sunken);">
        <div :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }">
            <div
                v-for="vRow in rowVirtualizer.getVirtualItems()"
                :key="vRow.index"
                :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }"
            >
                <RequestRow
                    :request="requests[vRow.index]"
                    :is-active="requests[vRow.index].id === activeRequestId"
                    :instance-options="getInstanceOptions(requests[vRow.index].instanceId)"
                    @select="$emit('select', $event)"
                />
            </div>
        </div>
    </div>
</template>
```

- [ ] **Step 2: Rewrite RequestRow.vue**

```vue
<script setup lang="ts">
import type { RequestRecord, DevtoolsInstanceOptions, CacheOptions } from "../../../shared/types/index";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{
    request: RequestRecord;
    isActive: boolean;
    instanceOptions?: DevtoolsInstanceOptions;
}>();
defineEmits<{ select: [id: string] }>();

function formatDuration(ms: number | null): string {
    if (ms === null) return "…";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}
function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
}
function getCacheId(opts: DevtoolsInstanceOptions): string | undefined {
    if (!opts.cache) return undefined;
    if (typeof opts.cache === "string") return opts.cache;
    return (opts.cache as CacheOptions).id;
}
function hasSwr(opts: DevtoolsInstanceOptions): boolean {
    if (!opts.cache || typeof opts.cache === "string") return false;
    return (opts.cache as CacheOptions).swr === true;
}
</script>

<template>
    <div
        data-vmd-request-row
        class="request-row"
        :class="{ 'request-row--active': isActive }"
        @click="$emit('select', request.id)"
    >
        <div class="accent-bar" :class="`accent-bar--${request.status}`" />

        <div class="row-body">
            <!-- Top: method + url + feature badges -->
            <div class="row-top">
                <span class="method-badge" :class="`method-${request.method.toLowerCase()}`">
                    {{ request.method }}
                </span>
                <span class="row-url">{{ request.url }}</span>
                <div v-if="instanceOptions" class="feature-badges">
                    <span v-if="instanceOptions.cache" class="feature-badge fb-cache">
                        cache<template v-if="getCacheId(instanceOptions)">
                            <span class="fb-sep">·</span>{{ getCacheId(instanceOptions) }}
                        </template>
                    </span>
                    <span v-if="hasSwr(instanceOptions)" class="feature-badge fb-swr">swr</span>
                    <span v-if="instanceOptions.poll" class="feature-badge fb-polling">polling</span>
                    <span v-if="instanceOptions.retry" class="feature-badge fb-retry">retry</span>
                    <span v-if="instanceOptions.batch" class="feature-badge fb-batch">batch</span>
                    <span v-if="instanceOptions.debounce" class="feature-badge fb-debounce">debounce</span>
                    <span v-if="!instanceOptions.immediate || instanceOptions.lazy" class="feature-badge fb-lazy">lazy</span>
                </div>
            </div>
            <!-- Bottom: status + duration + time -->
            <div class="row-meta">
                <StatusBadge :status="request.status" :status-code="request.statusCode" />
                <span class="meta-duration">{{ formatDuration(request.duration) }}</span>
                <span class="meta-time">{{ formatTime(request.startedAt) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.request-row {
    display: flex;
    align-items: stretch;
    cursor: pointer;
    border-bottom: 1px solid var(--dt-border-subtle);
    transition: background 0.12s;
    position: relative;
    min-height: 52px;
}
.request-row:hover { background: var(--dt-surface); }
.request-row--active { background: var(--dt-surface-raised); }
.request-row--active::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 2px;
    background: var(--dt-primary);
}

.accent-bar { width: 3px; flex-shrink: 0; }
.accent-bar--success { background: var(--dt-vue-green); }
.accent-bar--error   { background: var(--dt-danger); }
.accent-bar--pending { background: var(--dt-foreground-subtle); }
.accent-bar--aborted { background: var(--dt-foreground-subtle); }

.row-body { flex: 1; min-width: 0; padding: 9px 12px; }

.row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
    min-width: 0;
}
.row-url {
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
}
.row-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
}
.meta-duration { color: var(--dt-foreground-muted); }
.meta-time { color: var(--dt-foreground-subtle); margin-left: auto; }

/* Method badges */
.method-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
}
.method-get    { background: var(--dt-info-subtle);    color: var(--dt-info); }
.method-post   { background: var(--dt-success-subtle); color: var(--dt-success); }
.method-put    { background: var(--dt-warning-subtle); color: var(--dt-warning); }
.method-patch  { background: oklch(24% 0.07 200); color: oklch(66% 0.18 200); }
.method-delete { background: var(--dt-danger-subtle);  color: var(--dt-danger); }

/* Feature badges */
.feature-badges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    overflow: hidden;
}
.feature-badge {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
}
.fb-sep { opacity: 0.4; margin: 0 2px; }
.fb-cache    { background: oklch(22% 0.06 220); color: oklch(66% 0.18 220); border: 1px solid oklch(32% 0.08 220); }
.fb-swr      { background: oklch(22% 0.08 190); color: oklch(66% 0.20 190); border: 1px solid oklch(32% 0.10 190); }
.fb-polling  { background: var(--dt-primary-subtle); color: var(--dt-primary); border: 1px solid oklch(38% 0.14 280); }
.fb-retry    { background: var(--dt-warning-subtle); color: var(--dt-warning); border: 1px solid oklch(34% 0.10 75); }
.fb-batch    { background: oklch(22% 0.06 300); color: oklch(68% 0.18 300); border: 1px solid oklch(32% 0.09 300); }
.fb-debounce { background: oklch(22% 0.06 50);  color: oklch(70% 0.16 50);  border: 1px solid oklch(32% 0.09 50); }
.fb-lazy     { background: oklch(20% 0.04 270); color: oklch(58% 0.08 270); border: 1px solid oklch(30% 0.06 270); }
</style>
```

- [ ] **Step 3: Verify in playground**

Open the Network tab. Each request row should show two lines: method + url + badges on top, status + duration + time on bottom. The accent bar on the left reflects request status color.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/network/components/RequestList.vue \
        packages/devtools/src/features/network/components/RequestRow.vue
git commit -m "feat(devtools): request row feature badges (cache, swr, polling, retry, batch, debounce, lazy)"
```

---

## Task 8: NetworkTab — Toolbar + Filter Bar + Drag Split

**Files:**
- Modify: `packages/devtools/src/features/network/components/NetworkTab.vue`

- [ ] **Step 1: Rewrite NetworkTab.vue**

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { useNetworkTab } from "../composables/useNetworkTab";
import RequestList from "./RequestList.vue";
import RequestDetail from "./RequestDetail.vue";

const {
    urlFilter, statusFilter, instanceFilter, filteredRequests, clearFilters,
    selectedRequest, selectedRequestId,
    viewMode, payloadFormat, responseFormat,
    selectRequest, setViewMode, togglePayloadFormat, toggleResponseFormat,
    instances,
} = useNetworkTab();

const instanceList = computed(() => [...instances.value.values()]);

// Drag-resize: list width vs detail pane
const listWidth = ref(320);
const MIN_LIST_WIDTH = 180;
const splitRef = ref<HTMLElement | null>(null);

function startListResize(e: MouseEvent): void {
    const startX = e.clientX;
    const startW = listWidth.value;

    function onMove(ev: MouseEvent): void {
        const maxW = splitRef.value
            ? splitRef.value.offsetWidth * 0.7
            : 800;
        listWidth.value = Math.max(MIN_LIST_WIDTH, Math.min(startW + (ev.clientX - startX), maxW));
    }
    function onUp(): void {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
}
</script>

<template>
    <div class="network-tab">
        <!-- Toolbar -->
        <div class="toolbar">
            <input
                v-model="urlFilter"
                placeholder="Filter URL…"
                class="toolbar-input"
            />
            <select v-model="statusFilter" class="toolbar-select">
                <option value="all">All statuses</option>
                <option v-for="s in ['pending', 'success', 'error', 'aborted']" :key="s" :value="s">
                    {{ s }}
                </option>
            </select>
            <select v-model="instanceFilter" class="toolbar-select">
                <option value="all">All instances</option>
                <option v-for="inst in instanceList" :key="inst.id" :value="inst.id">
                    {{ inst.url ?? inst.id }}
                </option>
            </select>
            <button class="toolbar-btn" @click="clearFilters">Clear</button>
        </div>

        <!-- Filter pills -->
        <div class="filter-bar">
            <button
                v-for="pill in ['all', 'success', 'error', 'pending', 'aborted']"
                :key="pill"
                class="filter-pill"
                :class="{ 'filter-pill--active': statusFilter === pill }"
                @click="statusFilter = pill"
            >
                {{ pill === 'all' ? 'All' : pill }}
            </button>
            <span class="filter-count">{{ filteredRequests.length }} requests</span>
        </div>

        <!-- Main split: list + drag handle + detail -->
        <div ref="splitRef" class="main-split">
            <!-- Request list (resizable width) -->
            <div
                class="list-pane"
                :style="selectedRequest ? { width: listWidth + 'px' } : { flex: '1' }"
            >
                <RequestList
                    :requests="filteredRequests"
                    :active-request-id="selectedRequestId"
                    @select="selectRequest"
                />
            </div>

            <!-- Drag handle (only when detail is open) -->
            <div
                v-if="selectedRequest"
                class="drag-handle"
                @mousedown="startListResize"
            />

            <!-- Request detail -->
            <div v-if="selectedRequest" class="detail-pane">
                <RequestDetail
                    :request="selectedRequest"
                    :view-mode="viewMode"
                    :payload-format="payloadFormat"
                    :response-format="responseFormat"
                    @close="selectRequest(null)"
                    @set-view-mode="setViewMode"
                    @toggle-payload-format="togglePayloadFormat"
                    @toggle-response-format="toggleResponseFormat"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.network-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--dt-surface-sunken);
    color: var(--dt-foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* Toolbar */
.toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
.toolbar-input {
    flex: 1;
    height: 30px;
    background: var(--dt-surface);
    border: 1px solid var(--dt-border);
    border-radius: 7px;
    color: var(--dt-foreground);
    font-size: 12px;
    padding: 0 10px;
    outline: none;
}
.toolbar-input::placeholder { color: var(--dt-foreground-subtle); }
.toolbar-input:focus { border-color: var(--dt-primary); }
.toolbar-select {
    height: 30px;
    background: var(--dt-surface);
    border: 1px solid var(--dt-border);
    border-radius: 7px;
    color: var(--dt-foreground-secondary);
    font-size: 12px;
    padding: 0 8px;
    cursor: pointer;
    outline: none;
}
.toolbar-btn {
    height: 30px;
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--dt-border);
    border-radius: 7px;
    color: var(--dt-foreground-muted);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}
.toolbar-btn:hover { background: var(--dt-surface-raised); color: var(--dt-foreground); }

/* Filter bar */
.filter-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 7px 12px;
    background: var(--dt-surface-sunken);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
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
    transition: all 0.12s;
    text-transform: capitalize;
}
.filter-pill:hover { background: var(--dt-surface-raised); color: var(--dt-foreground-secondary); }
.filter-pill--active { background: var(--dt-primary-subtle); color: var(--dt-primary); border-color: var(--dt-primary); }
.filter-count { margin-left: auto; font-size: 11px; color: var(--dt-foreground-subtle); }

/* Main split */
.main-split { display: flex; flex: 1; overflow: hidden; }
.list-pane { min-width: 180px; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.detail-pane { flex: 1; min-width: 200px; overflow: hidden; }

/* Drag handle */
.drag-handle {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.drag-handle:hover { background: var(--dt-primary); }
</style>
```

- [ ] **Step 2: Verify in playground**

Open Network tab. Drag the handle between the request list and detail panel — list should resize. Filter pills should highlight when clicked.

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/components/NetworkTab.vue
git commit -m "feat(devtools): network tab toolbar, filter bar, and drag-resizable list/detail split"
```

---

## Task 9: JsonViewer — No Wrap + oklch Colors

**Files:**
- Modify: `packages/devtools/src/shared/components/JsonViewer.vue`

- [ ] **Step 1: Rewrite JsonViewer.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: unknown }>();

const highlighted = computed(() => {
    try {
        const json = JSON.stringify(props.value, null, 2);
        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
                    return `<span class="json-string">${match}</span>`;
                }
                if (/true|false|null/.test(match)) return `<span class="json-bool">${match}</span>`;
                return `<span class="json-number">${match}</span>`;
            },
        );
    } catch {
        return String(props.value);
    }
});
</script>

<template>
    <pre class="json-root" v-html="highlighted" />
</template>

<style scoped>
.json-root {
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre;
    overflow-x: auto;
    color: var(--dt-foreground);
    margin: 0;
}
.json-root :deep(.json-key)    { color: oklch(72% 0.17 260); }
.json-root :deep(.json-string) { color: oklch(72% 0.17 145); }
.json-root :deep(.json-number) { color: oklch(74% 0.18 55); }
.json-root :deep(.json-bool)   { color: oklch(72% 0.18 25); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/shared/components/JsonViewer.vue
git commit -m "feat(devtools): json viewer nowrap with horizontal scroll and oklch syntax colors"
```

---

## Task 10: KvViewer

**Files:**
- Create: `packages/devtools/src/features/network/components/KvViewer.vue`

- [ ] **Step 1: Create KvViewer.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: unknown }>();

type ValueType = "string" | "number" | "boolean" | "null" | "object" | "array";

interface KvRow {
    key: string;
    displayValue: string;
    valueType: ValueType;
}

function toRows(obj: Record<string, unknown>): KvRow[] {
    return Object.entries(obj).map(([key, v]) => {
        if (v === null)
            return { key, displayValue: "null", valueType: "null" };
        if (typeof v === "boolean")
            return { key, displayValue: String(v), valueType: "boolean" };
        if (typeof v === "number")
            return { key, displayValue: String(v), valueType: "number" };
        if (typeof v === "string")
            return { key, displayValue: `"${v}"`, valueType: "string" };
        if (Array.isArray(v))
            return { key, displayValue: `Array [${v.length}]`, valueType: "array" };
        if (typeof v === "object")
            return { key, displayValue: `Object {${Object.keys(v as object).length}}`, valueType: "object" };
        return { key, displayValue: String(v), valueType: "string" };
    });
}

const rows = computed((): KvRow[] => {
    if (!props.value || typeof props.value !== "object") return [];
    return toRows(props.value as Record<string, unknown>);
});
</script>

<template>
    <table class="kv-table">
        <tbody>
            <tr v-for="row in rows" :key="row.key" class="kv-row">
                <td class="kv-key">{{ row.key }}</td>
                <td class="kv-value" :class="`kv-${row.valueType}`">
                    <span
                        v-if="row.valueType === 'object' || row.valueType === 'array'"
                        class="kv-nested"
                    >{{ row.displayValue }} ▾</span>
                    <template v-else>{{ row.displayValue }}</template>
                </td>
            </tr>
        </tbody>
    </table>
</template>

<style scoped>
.kv-table {
    width: 100%;
    border-collapse: collapse;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
}
.kv-row { border-bottom: 1px solid var(--dt-border-subtle); }
.kv-row:last-child { border-bottom: none; }
.kv-row:hover td { background: var(--dt-surface); }
.kv-key {
    padding: 6px 10px;
    color: var(--dt-foreground-secondary);
    font-weight: 500;
    white-space: nowrap;
    width: 38%;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
}
.kv-value {
    padding: 6px 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
}
.kv-string  { color: oklch(72% 0.17 145); }
.kv-number  { color: oklch(74% 0.18 55); }
.kv-boolean { color: oklch(72% 0.18 25); }
.kv-null    { color: var(--dt-foreground-subtle); }
.kv-nested {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--dt-surface-raised);
    color: var(--dt-foreground-muted);
    cursor: pointer;
    font-size: 11px;
}
.kv-nested:hover { background: var(--dt-primary-subtle); color: var(--dt-primary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/features/network/components/KvViewer.vue
git commit -m "feat(devtools): add KvViewer component with type-aware display and nested-object badges"
```

---

## Task 11: DataPane

**Files:**
- Create: `packages/devtools/src/features/network/components/DataPane.vue`

- [ ] **Step 1: Create DataPane.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import JsonViewer from "../../../shared/components/JsonViewer.vue";
import KvViewer from "./KvViewer.vue";

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

<template>
    <div class="data-pane">
        <div class="pane-header">
            <span class="pane-title">{{ title }}</span>
            <button
                class="pane-action"
                :class="{ 'pane-action--active': mode === 'kv' }"
                @click="mode = mode === 'kv' ? 'json' : 'kv'"
            >KV</button>
            <button class="pane-action" @click="copy">Copy</button>
        </div>
        <div class="pane-body">
            <p v-if="truncated" class="truncated-warning">[truncated]</p>
            <JsonViewer v-if="mode === 'json'" :value="data" />
            <KvViewer v-else :value="data" />
        </div>
    </div>
</template>

<style scoped>
.data-pane {
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
    text-transform: uppercase;
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
.pane-body {
    flex: 1;
    overflow: auto;
    padding: 12px;
}
.pane-body::-webkit-scrollbar { width: 4px; height: 4px; }
.pane-body::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.truncated-warning {
    font-size: 11px;
    color: var(--dt-warning);
    margin-bottom: 8px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/features/network/components/DataPane.vue
git commit -m "feat(devtools): add DataPane reusable component with JSON/KV toggle and copy"
```

---

## Task 12: SplitView

**Files:**
- Create: `packages/devtools/src/features/network/components/SplitView.vue`

- [ ] **Step 1: Create SplitView.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import DataPane from "./DataPane.vue";
import type { RequestRecord } from "../../../shared/types/index";

defineProps<{ request: RequestRecord }>();

const leftWidth = ref<number | null>(null);
const splitRef = ref<HTMLElement | null>(null);

function startSplitResize(e: MouseEvent): void {
    const container = splitRef.value;
    if (!container) return;

    const startX = e.clientX;
    const startW = leftWidth.value ?? container.offsetWidth / 2;

    function onMove(ev: MouseEvent): void {
        const maxW = container.offsetWidth - 120 - 5;
        leftWidth.value = Math.max(120, Math.min(startW + (ev.clientX - startX), maxW));
    }
    function onUp(): void {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
}
</script>

<template>
    <div ref="splitRef" class="split-view">
        <!-- Payload pane -->
        <div
            class="split-pane"
            :style="leftWidth !== null ? { flex: 'none', width: leftWidth + 'px' } : {}"
        >
            <DataPane title="Payload" :data="request.payload" :truncated="request.truncated" />
        </div>

        <!-- Drag handle -->
        <div class="split-handle" @mousedown="startSplitResize" />

        <!-- Response pane -->
        <div class="split-pane">
            <DataPane title="Response" :data="request.response" :truncated="request.truncated" />
        </div>
    </div>
</template>

<style scoped>
.split-view {
    display: flex;
    height: 100%;
    overflow: hidden;
}
.split-pane {
    flex: 1;
    min-width: 120px;
    overflow: hidden;
}
.split-pane + .split-pane {
    border-left: 1px solid var(--dt-border-subtle);
}
.split-handle {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--dt-border-subtle);
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.split-handle:hover { background: var(--dt-primary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/devtools/src/features/network/components/SplitView.vue
git commit -m "feat(devtools): add SplitView component with drag-resizable payload/response panes"
```

---

## Task 13: DetailHeader + DetailTabs

**Files:**
- Create: `packages/devtools/src/features/network/components/DetailHeader.vue`
- Create: `packages/devtools/src/features/network/components/DetailTabs.vue`

- [ ] **Step 1: Create DetailHeader.vue**

```vue
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { RequestRecord } from "../../../shared/types/index";

defineProps<{ request: RequestRecord }>();
defineEmits<{ close: [] }>();

function statusClass(code: number | null): string {
    if (!code) return "s-pending";
    if (code < 300) return "s-2xx";
    if (code < 400) return "s-3xx";
    if (code < 500) return "s-4xx";
    return "s-5xx";
}
</script>

<template>
    <div class="detail-header">
        <span class="status-chip" :class="statusClass(request.statusCode)">
            {{ request.statusCode ?? "···" }}
        </span>
        <span class="req-method">{{ request.method }}</span>
        <span class="req-url" :title="request.url">{{ request.url }}</span>
        <div class="req-meta">
            <span v-if="request.duration !== null">{{ request.duration }}ms</span>
            <span>{{ new Date(request.startedAt).toLocaleTimeString() }}</span>
        </div>
        <button class="close-btn" @click="$emit('close')">
            <Icon icon="lucide:x" width="14" height="14" />
        </button>
    </div>
</template>

<style scoped>
.detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.status-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    flex-shrink: 0;
}
.s-2xx { background: var(--dt-success-subtle); color: var(--dt-success); }
.s-3xx { background: var(--dt-info-subtle);    color: var(--dt-info); }
.s-4xx { background: var(--dt-warning-subtle); color: var(--dt-warning); }
.s-5xx { background: var(--dt-danger-subtle);  color: var(--dt-danger); }
.s-pending { background: var(--dt-surface-raised); color: var(--dt-foreground-subtle); }
.req-method {
    font-size: 12px;
    font-weight: 600;
    color: var(--dt-foreground-secondary);
    flex-shrink: 0;
}
.req-url {
    font-size: 12px;
    font-weight: 500;
    color: var(--dt-foreground);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
.req-meta {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--dt-foreground-muted);
}
.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--dt-foreground-muted);
    cursor: pointer;
    flex-shrink: 0;
}
.close-btn:hover { background: var(--dt-surface-raised); color: var(--dt-foreground); }
</style>
```

- [ ] **Step 2: Create DetailTabs.vue**

```vue
<script setup lang="ts">
type TabId = "split" | "payload" | "response" | "headers";

defineProps<{ activeTab: TabId }>();
defineEmits<{ select: [tab: TabId] }>();

const tabs: ReadonlyArray<{ id: TabId; label: string }> = [
    { id: "split",    label: "Split" },
    { id: "payload",  label: "Payload" },
    { id: "response", label: "Response" },
    { id: "headers",  label: "Headers" },
] as const;
</script>

<template>
    <div class="detail-tabs">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ 'tab-btn--active': tab.id === activeTab }"
            @click="$emit('select', tab.id)"
        >
            {{ tab.label }}
        </button>
    </div>
</template>

<style scoped>
.detail-tabs {
    display: flex;
    background: var(--dt-nav);
    border-bottom: 1px solid var(--dt-border-subtle);
    flex-shrink: 0;
}
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
.tab-btn:hover { color: var(--dt-foreground-secondary); }
.tab-btn--active { color: var(--dt-primary); border-bottom-color: var(--dt-primary); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add packages/devtools/src/features/network/components/DetailHeader.vue \
        packages/devtools/src/features/network/components/DetailTabs.vue
git commit -m "feat(devtools): add DetailHeader and DetailTabs components"
```

---

## Task 14: RequestDetail — Overhaul

**Files:**
- Modify: `packages/devtools/src/features/network/components/RequestDetail.vue`

- [ ] **Step 1: Rewrite RequestDetail.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { RequestRecord } from "../../../shared/types/index";
import DetailHeader from "./DetailHeader.vue";
import DetailTabs from "./DetailTabs.vue";
import SplitView from "./SplitView.vue";
import DataPane from "./DataPane.vue";

defineProps<{ request: RequestRecord }>();
defineEmits<{ close: [] }>();

type TabId = "split" | "payload" | "response" | "headers";
const activeTab = ref<TabId>("split");
</script>

<template>
    <div class="request-detail">
        <DetailHeader :request="request" @close="$emit('close')" />
        <DetailTabs :active-tab="activeTab" @select="activeTab = $event" />

        <div class="detail-content">
            <SplitView v-if="activeTab === 'split'" :request="request" />

            <DataPane
                v-else-if="activeTab === 'payload'"
                title="Payload"
                :data="request.payload"
                :truncated="request.truncated"
            />

            <DataPane
                v-else-if="activeTab === 'response'"
                title="Response"
                :data="request.response"
                :truncated="request.truncated"
            />

            <div v-else-if="activeTab === 'headers'" class="headers-view">
                <div
                    v-for="(val, key) in request.requestHeaders"
                    :key="key"
                    class="header-row"
                >
                    <span class="header-key">{{ key }}</span>
                    <span class="header-val">{{ val }}</span>
                </div>
                <p v-if="!Object.keys(request.requestHeaders).length" class="empty-msg">
                    No request headers captured.
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.request-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--dt-surface-sunken);
}
.detail-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.headers-view {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    font-size: 12px;
}
.headers-view::-webkit-scrollbar { width: 4px; }
.headers-view::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.header-row {
    display: flex;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--dt-border-subtle);
}
.header-row:last-child { border-bottom: none; }
.header-key {
    color: oklch(72% 0.17 260);
    width: 38%;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.header-val {
    color: var(--dt-foreground-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}
.empty-msg { color: var(--dt-foreground-subtle); font-size: 12px; }
</style>
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @ametie/vue-muza-devtools test --run
```

Expected: all tests pass.

- [ ] **Step 3: Verify in playground end-to-end**

- Open the playground devtools panel
- Click a request — detail panel opens
- **Split tab** (default): Payload on left, Response on right, both scrollable, drag handle resizes them
- **KV toggle**: click KV button on either pane — switches to key-value table, nested objects show `Object {N} ▾`
- **Copy**: clicks copy button — JSON copied to clipboard
- **Payload / Response tabs**: full single-pane view with scroll, no text wrapping
- **Headers tab**: key/value list of request headers
- Close button (✕) closes the detail panel

- [ ] **Step 4: Commit**

```bash
git add packages/devtools/src/features/network/components/RequestDetail.vue
git commit -m "feat(devtools): overhaul RequestDetail using DetailHeader, DetailTabs, SplitView, DataPane"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Launcher: pill shape, M icon, "vue-muza" text, purple | Task 4+5 |
| M icon: two-tone inverted Vue V (∧∧) | Task 4 |
| Panel: bottom drawer, tabs on top, Vue green active | Task 5 |
| Design tokens: oklch custom properties | Task 1 |
| Network: Nuxt-style rows with left accent | Task 7 |
| Network: drag-resizable list/detail split | Task 8 |
| Network: filter pills + toolbar | Task 8 |
| RequestRow: feature badges (cache·id, swr, polling, retry, batch, debounce, lazy) | Task 7 |
| Detail: split mode default (Payload + Response side by side) | Task 12+14 |
| Detail: drag handle between payload and response | Task 12 |
| Detail: JSON viewer with nowrap + colors | Task 9 |
| Detail: KV viewer with nested object badges | Task 10 |
| Detail: DataPane reusable | Task 11 |
| Detail: DetailHeader + DetailTabs extracted | Task 13 |
| Headers tab | Task 14 |

All spec sections covered. No gaps found.
