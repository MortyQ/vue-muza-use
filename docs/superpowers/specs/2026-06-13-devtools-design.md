# Devtools Design — @ametie/vue-muza-use

**Date:** 2026-06-13
**Status:** Approved

---

## Overview

A floating developer panel built into the main `@ametie/vue-muza-use` package, activated via `createApi({ devtools: { enabled: true } })`. Disabled by default. Zero production overhead when disabled.

Inspired by Nuxt DevTools in layout and approach: dark floating panel, vertical icon sidebar, tab-based content.

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Package location | `packages/devtools/` (internal workspace) | Clean separation, easy to publish separately later |
| Activation | `devtools: { enabled: false }` by default | Consumer controls it explicitly — `devtools: process.env.NODE_ENV !== 'production'` |
| Production guard | Consumer passes condition, library doesn't assume env | Reliable dead code elimination by consumer's bundler |
| Loading | Dynamic import `await import('@ametie/vue-muza-devtools')` | Devtools chunk only loaded when enabled |
| Persistence | IndexedDB via `keyv-browser` (same as muzakit) | Clean, async, no size limits |
| Styles | Tailwind 4 with `vmd:` prefix | No conflicts with consumer's Tailwind |
| UI architecture | Isolated Vue app mounted in separate div | No style/provider conflicts with host app |
| Panel type | Floating, draggable | Flexible positioning, not tied to viewport edge |

---

## Package Name

`packages/devtools` is a workspace package named **`@ametie/vue-muza-devtools`**. This matches the dynamic import path in the bridge. It is internal (`private: true`) for now — structure is ready to be published separately when needed.

---

## Repository Structure

```
packages/
  use-api/
    src/
      devtools.ts              ← thin bridge: no-op functions, dynamic import
  devtools/
    src/
      app/
        index.ts               ← createBridge() — wires store + UI + returns bridge
        devtoolsPlugin.ts      ← mounts isolated Vue app into DOM
      features/
        panel/
          composables/
            useFloatingPanel.ts  ← position, drag, open/close, IndexedDB persist
            useTabManager.ts     ← active tab, tab list from registry, IndexedDB persist
          components/
            FloatingPanel.vue
            PanelHeader.vue
            TabBar.vue
            ResizeHandle.vue
        instances/
          composables/
            useInstancesTab.ts
            useInstanceDetail.ts
            useInstanceFilter.ts
          components/
            InstancesTab.vue
            InstanceRow.vue
            InstanceDetail.vue
            StateDisplay.vue
          index.ts              ← exports instancesTab: DevtoolsTab descriptor
        network/
          composables/
            useNetworkTab.ts
            useRequestDetail.ts
            useNetworkFilter.ts
          components/
            NetworkTab.vue
            RequestList.vue
            RequestRow.vue
            RequestDetail.vue
            PayloadView.vue
            ResponseView.vue
            StatusBadge.vue
          index.ts              ← exports networkTab: DevtoolsTab descriptor
        timeline/
          composables/
            useTimelineTab.ts
            useTimelineFilter.ts
          components/
            TimelineTab.vue
            TimelineTrack.vue
            TimelineEvent.vue
          index.ts              ← exports timelineTab: DevtoolsTab descriptor
      shared/
        store/
          devtoolsStore.ts     ← singleton reactive store, all mutations here
        instrumentation/
          instanceTracker.ts
          requestTracker.ts
        composables/
          useDevtoolsStore.ts  ← composable wrapper returning stable computed refs
          useTabRegistry.ts
        components/
          JsonViewer.vue
          Badge.vue
          CopyButton.vue
          KeyValueTable.vue
        types/
          index.ts
        plugins/
          tabRegistry.ts
        storage/
          devtoolsStorage.ts   ← IndexedDB via keyv-browser
      index.ts                 ← exports createBridge()
```

---

## Architecture: Data Flow

```
use-api (useApi.ts)
  │  calls bridge functions synchronously
  ▼
use-api/src/devtools.ts        ← thin bridge, dynamic import on init
  │  onInstanceCreated / onInstanceDestroyed / onStateUpdate
  │  onRequestStart / onRequestEnd
  ▼
shared/instrumentation/        ← writes to store
  instanceTracker.ts
  requestTracker.ts
  ▼
shared/store/devtoolsStore.ts  ← single source of truth
  ▼
features/*/composables/        ← read store via useDevtoolsStore(), compute derived state
  ▼
features/*/components/         ← render only, no direct store access
```

**Rule:** UI never calls axios. UI never imports from `use-api` internals. Features never import from each other.

---

## FSD Import Rules

```
app      → features, shared
features → shared only
features → NOT other features
shared   → nothing (no upward imports)
```

Each `features/<name>/index.ts` is the only public surface of that feature.

---

## Types (`shared/types/index.ts`)

### Request

```ts
type RequestStatus = "pending" | "success" | "error" | "aborted";

interface RequestRecord {
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
    response: unknown;
    error: ApiError | null;
    truncated: boolean;
}
```

### Instance

```ts
interface DevtoolsInstanceState {
    loading: boolean;
    error: ApiError | null;
    statusCode: number | null;
    data: unknown;
}

interface DevtoolsInstanceOptions {
    authMode: AuthMode;
    cache: CacheOptions | string | undefined;
    retry: boolean | number;
    poll: number;
    immediate: boolean;
    lazy: boolean;
}

interface DevtoolsInstance {
    id: string;
    url: string | undefined;
    method: string;
    createdAt: number;
    state: DevtoolsInstanceState;
    options: DevtoolsInstanceOptions;
    requestCount: number;
    lastRequestAt: number | null;
}
```

### Bridge (contract between use-api and devtools)

```ts
type RequestEndResult =
    | { status: "success"; statusCode: number; response: unknown; duration: number }
    | { status: "error"; error: ApiError; statusCode: number | null; duration: number }
    | { status: "aborted"; duration: number };

interface DevtoolsBridge {
    onInstanceCreated: (id: string, url: string | undefined, options: UseApiOptions) => void;
    onInstanceDestroyed: (id: string) => void;
    onStateUpdate: (id: string, state: Partial<DevtoolsInstanceState>) => void;
    onRequestStart: (record: Omit<RequestRecord, "duration" | "response" | "error" | "truncated">) => void;
    onRequestEnd: (id: string, result: RequestEndResult) => void;
}
```

### Config & Plugin System

```ts
interface DevtoolsTab {
    id: string;
    label: string;
    component: Component;
    icon?: string | Component;
    order?: number;
}

interface DevtoolsOptions {
    enabled: boolean;
    maxHistory?: number;      // default: 100
    maxPayloadSize?: number;  // bytes, default: 50_000
    tabs?: DevtoolsTab[];     // custom tabs appended after built-ins
}
```

---

## Store (`shared/store/devtoolsStore.ts`)

Singleton. Vue `reactive()` state. All mutations are internal functions. UI reads via stable `computed` refs exposed through `useDevtoolsStore()`.

```ts
// stable computed refs — created once at module level
export const instances: ComputedRef<ReadonlyMap<string, DevtoolsInstance>>
export const requests: ComputedRef<ReadonlyArray<RequestRecord>>

// mutations
export function initDevtoolsStore(config): void
export function registerInstance(id, url, options): void
export function unregisterInstance(id): void
export function updateInstanceState(id, state): void
export function addRequest(partial): void      // enforces maxHistory circular buffer
export function updateRequest(id, result): void // truncates payload/response if > maxPayloadSize
export function clearRequests(): void
export function getRequestsByInstance(instanceId): ReadonlyArray<RequestRecord>
```

**Truncation:** `addRequest` / `updateRequest` serialize payload/response, truncate at `maxPayloadSize` bytes, set `truncated: true` on the record.

**Circular buffer:** `addRequest` calls `state.requests.shift()` when `length >= maxHistory`.

---

## Bridge in use-api (`use-api/src/devtools.ts`)

```ts
let bridge: DevtoolsBridge | null = null;

export async function initDevtools(options: DevtoolsOptions, app: App): Promise<void> {
    if (!options.enabled) return;
    try {
        const { createBridge } = await import("@ametie/vue-muza-devtools");
        bridge = createBridge(options, app);
    } catch {
        console.warn("[vue-muza-use] devtools enabled but @ametie/vue-muza-devtools not found");
    }
}

export const devtoolsBridge = {
    onInstanceCreated: (...args) => bridge?.onInstanceCreated(...args),
    onInstanceDestroyed: (id) => bridge?.onInstanceDestroyed(id),
    onStateUpdate: (...args) => bridge?.onStateUpdate(...args),
    onRequestStart: (record) => bridge?.onRequestStart(record),
    onRequestEnd: (...args) => bridge?.onRequestEnd(...args),
};
```

`initDevtools()` is called once from `plugin.ts` inside `createApi()` install hook, passing `options.devtools` and `app`.

Called from `useApi.ts`:
- `instanceId` via `useId()` — called in setup context
- `requestId` via `nextRequestId()` counter — called inside execute()

---

## Tab Registry (`shared/plugins/tabRegistry.ts`)

```ts
export const registeredTabs: ComputedRef<RegisteredTab[]>  // sorted by order
export function registerTab(tab: DevtoolsTab): void        // guards against duplicates
export function unregisterTab(id: string): void
```

Built-in tabs registered in `app/index.ts` with fixed order (0, 1, 2). Custom tabs from `options.tabs` appended after, auto-ordered.

---

## Persistence (`shared/storage/devtoolsStorage.ts`)

Uses `keyv-browser` / `KeyvIndexedDB` (same library as muzakit). Namespace: `vue-muza-devtools`.

Persisted values:
- Panel position `{ x, y }` and size `{ width, height }`
- Active tab ID

Not persisted: request history (session-only, resets on page reload).

Storage keys:
- `vmd:panel-position` → `{ x: number, y: number }`
- `vmd:panel-size` → `{ width: number, height: number }`
- `vmd:active-tab` → `string`

Read on `onMounted`, written via `watchEffect`.

---

## Panel Layout

Floating panel, draggable via `PanelHeader`. Isolated Vue app (`createApp(FloatingPanel)`) mounted in `<div id="vue-muza-devtools-root">` appended to `document.body`.

```
┌─────────────────────────────────────────────┐
│ ● vue-muza devtools              ⠿  —  ✕   │  ← PanelHeader (drag handle)
├──────┬──────────────────────────────────────┤
│  📋  │                                      │
│  🌐  │   <active tab content>               │
│  ⏱  │                                      │
└──────┴──────────────────────────────────────┘
  ↑ TabBar (vertical, icons + label on hover)
```

Icons via `@iconify/vue`. Styles: Tailwind 4 with `vmd:` prefix + `--ui-*` tokens from muzakit design system.

---

## Network Tab — UI Detail

**List columns:** method · url · status badge · duration · timestamp

**Detail panel:** split view by default (Payload left, Response right). Toggle: `Split | Payload | Response | Headers`.

Each pane has independent **JSON ↔ KV** toggle. **JSON is default.**

- **JSON view:** syntax-highlighted (keys purple, strings green, numbers blue, booleans yellow)
- **KV view:** flat key-value table with type colors
- Truncated responses show `[truncated]` notice with byte count

**Filter bar:** URL search · status filter (All / pending / success / error / aborted) · instance filter dropdown · Clear button

---

## Features — Tab Summary

### Instances
- List of all live `useApi` instances with status indicator (loading spinner / error dot / idle)
- Click → detail view: current state + options + last N requests for this instance
- Search by URL

### Network
- Global request history (all instances combined), default view
- Filter by instance to see per-instance requests
- Virtual list (`@tanstack/vue-virtual`) for performance
- Click → split detail panel (Payload + Response, JSON default, KV toggle)

### Timeline
- Horizontal time axis, one track per instance
- Each request = colored bar (width = duration, color = status)
- Zoom in/out controls
- Filter by status

---

## Consumer API

```ts
// main.ts
app.use(createApi({
    axios: apiClient,
    devtools: {
        enabled: process.env.NODE_ENV !== 'production',
        maxHistory: 100,       // optional, default 100
        maxPayloadSize: 50000, // optional, default 50_000 bytes
        tabs: [                // optional custom tabs
            { id: 'my-tab', label: 'My Tab', component: MyTabComponent }
        ],
    },
}))
```

Built-in tabs (Instances, Network, Timeline) always present. Custom tabs appended after.

---

## Semver Impact

`[minor]` — additive change. New `devtools` option with `enabled: false` default. No behavior change for existing consumers. New internal `packages/devtools` workspace package.

---

## Out of Scope (for this spec)

- Publishing `packages/devtools` as a separate npm package (can be done later, structure supports it)
- Vue DevTools browser extension integration
- Dark/light theme toggle within the panel
- Request replay / resend functionality
