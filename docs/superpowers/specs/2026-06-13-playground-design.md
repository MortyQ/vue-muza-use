# Playground Design — @ametie/vue-muza-use

**Date:** 2026-06-13
**Status:** Approved

---

## Overview

A developer playground and documentation app for `@ametie/vue-muza-use`. Serves two purposes:
1. Living documentation — 28 isolated examples covering every library feature
2. Devtools testing environment — dedicated scenarios for testing the devtools panel during implementation

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Architecture | FSD (Feature-Sliced Design) | Mirrors muzakit-dashboard, scales well |
| Navigation | Left sidebar with grouped sections | Handles 28+ items, group labels, easy to extend |
| Routing | Vue Router, example-per-page | Deep-link to specific scenarios for devtools testing |
| UI library | `@ametie/ui` (local workspace) | Copy of muzakit/libs/ui, same namespace |
| Tailwind config | `@ametie/config` (local workspace) | Copy of muzakit/libs/config, OKLCH tokens |
| Code snippets | "Show Code" toggle per demo | Visible on demand, not obstructing the live demo |
| Auth | Live backend, creds in `.env` | One-click login via "Fill Demo Credentials" button |
| State management | Pinia (auth demo store only) | Mirrors muzakit-dashboard pattern |

---

## Repository Structure

```
useApi/
├── libs/
│   ├── config/                        ← @ametie/config
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── tailwind/
│   │           └── theme.css          ← OKLCH tokens, light/dark variants
│   └── ui/                            ← @ametie/ui
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── index.ts
│           ├── style.css
│           ├── styles/
│           │   ├── tokens.css         ← --ui-* CSS variables
│           │   └── components/
│           │       ├── base/          ← vbutton, vtag, vicon
│           │       ├── inputs/        ← vinput, vselect, vcheckbox, vswitch
│           │       ├── layout/        ← vcard
│           │       ├── feedback/      ← vtoaster, vloader
│           │       └── navigation-sidebar/
│           └── components/
│               ├── base/
│               │   ├── VButton.vue
│               │   ├── VIcon.vue
│               │   └── VTag.vue
│               ├── inputs/
│               │   ├── VInput.vue
│               │   ├── VSelect.vue
│               │   ├── VCheckbox.vue
│               │   └── VSwitch.vue
│               ├── layout/
│               │   └── VCard.vue
│               ├── feedback/
│               │   ├── VToaster.vue
│               │   └── VLoader.vue
│               └── navigation-sidebar/
│                   ├── NavigationSidebar.vue
│                   ├── NavigationSidebarMobile.vue
│                   ├── components/
│                   ├── composables/
│                   └── utils/
├── packages/
│   ├── use-api/
│   └── playground/
└── pnpm-workspace.yaml                ← packages: [packages/*, libs/*]
```

---

## Playground FSD Structure

```
packages/playground/src/
├── app/
│   ├── main.ts
│   ├── App.vue
│   ├── assets/
│   │   └── main.css                   ← @import theme + ui styles
│   ├── layouts/
│   │   └── DefaultLayout.vue          ← sidebar + <RouterView>
│   └── routes/
│       ├── index.ts                   ← createRouter
│       ├── modules.ts                 ← assembles all route files
│       ├── sidebar.ts                 ← SidebarNavItem[] config
│       └── paths/
│           ├── coreRoutes.ts
│           ├── batchRoutes.ts
│           ├── cacheRoutes.ts
│           ├── pollingRoutes.ts
│           ├── triggersRoutes.ts
│           ├── retryRoutes.ts
│           ├── authRoutes.ts
│           ├── stateRoutes.ts
│           └── devtoolsRoutes.ts
├── pages/
│   ├── core/
│   │   ├── BasicFetchPage.vue
│   │   ├── DynamicUrlPage.vue
│   │   ├── LazyPage.vue
│   │   ├── DebouncePage.vue
│   │   └── SelectTransformPage.vue
│   ├── batch/
│   │   ├── BasicBatchPage.vue
│   │   ├── ConcurrencyPage.vue
│   │   ├── SettledErrorsPage.vue
│   │   └── ReactiveBatchPage.vue
│   ├── cache/
│   │   ├── TtlCachePage.vue
│   │   ├── SwrPage.vue
│   │   └── InvalidationPage.vue
│   ├── polling/
│   │   ├── BasicPollingPage.vue
│   │   ├── WhenHiddenPage.vue
│   │   └── DynamicIntervalPage.vue
│   ├── triggers/
│   │   ├── RefetchOnFocusPage.vue
│   │   └── RefetchOnReconnectPage.vue
│   ├── retry/
│   │   ├── AutoRetryPage.vue
│   │   └── CustomStatusCodesPage.vue
│   ├── auth/
│   │   ├── LoginPage.vue
│   │   ├── TokenRefreshPage.vue
│   │   └── AuthModesPage.vue
│   ├── state/
│   │   ├── MutatePage.vue
│   │   ├── ResetPage.vue
│   │   └── IgnoreUpdatesPage.vue
│   └── devtools/
│       ├── KitchenSinkPage.vue
│       ├── StressTestPage.vue
│       └── ErrorStatesPage.vue
├── features/
│   ├── core/
│   │   ├── BasicFetch.vue
│   │   ├── DynamicUrl.vue
│   │   ├── Lazy.vue
│   │   ├── Debounce.vue
│   │   └── SelectTransform.vue
│   ├── batch/
│   │   ├── BasicBatch.vue
│   │   ├── Concurrency.vue
│   │   ├── SettledErrors.vue
│   │   └── ReactiveBatch.vue
│   ├── cache/
│   │   ├── TtlCache.vue
│   │   ├── Swr.vue
│   │   └── Invalidation.vue
│   ├── polling/
│   │   ├── BasicPolling.vue
│   │   ├── WhenHidden.vue
│   │   └── DynamicInterval.vue
│   ├── triggers/
│   │   ├── RefetchOnFocus.vue
│   │   └── RefetchOnReconnect.vue
│   ├── retry/
│   │   ├── AutoRetry.vue
│   │   └── CustomStatusCodes.vue
│   ├── auth/
│   │   ├── Login.vue
│   │   ├── TokenRefresh.vue
│   │   ├── AuthModes.vue
│   │   └── store/
│   │       └── useAuthDemoStore.ts
│   ├── state/
│   │   ├── Mutate.vue
│   │   ├── Reset.vue
│   │   └── IgnoreUpdates.vue
│   └── devtools/
│       ├── KitchenSink.vue            ← 8-10 instances simultaneously
│       ├── StressTest.vue             ← 20+ parallel requests
│       └── ErrorStates.vue            ← mixed 404 / 500 / 429 states
└── shared/
    ├── api/
    │   └── axios.ts                   ← createApiClient pointed at VITE_API_URL
    ├── components/
    │   └── DemoWrapper.vue            ← title + description + Show Code toggle
    ├── composables/
    │   └── useCodeBlock.ts            ← syntax highlight via highlight.js (vue plugin)
    └── types/
        └── index.ts
```

---

## Page Pattern

Pages are thin wrappers — zero logic, delegate to features:

```vue
<!-- pages/cache/SwrPage.vue -->
<script setup>
import SwrDemo from "@/features/cache/Swr.vue";
</script>
<template><swr-demo /></template>
```

---

## DemoWrapper

Every feature component is wrapped in `DemoWrapper`:

```vue
<DemoWrapper
  title="SWR Cache"
  description="Serve cached data instantly while revalidating in background."
  :code="codeSnippet"
>
  <!-- live demo slot -->
</DemoWrapper>
```

Layout:
```
┌─────────────────────────────────────────┐
│  SWR Cache                  [<> Code]   │
│  Serve cached data instantly while...   │
├─────────────────────────────────────────┤
│  [ live demo ]                          │
├─────────────────────────────────────────┤
│  // visible only when Code is open      │
│  const { data } = useApi('/users', {    │
│    cache: { id: 'users', swr: true }    │
│  })                                     │
└─────────────────────────────────────────┘
```

---

## Route Structure

```
/  →  redirect to /core/basic

Core
  /core/basic            Basic Fetch — immediate, loading, data, error
  /core/dynamic-url      Dynamic URL — reactive url ref, auto re-fetch
  /core/lazy             Lazy Mode — lazy: true, manual execute()
  /core/debounce         Debounce — debounce: 500, search input
  /core/select           Select Transform — select: (data) => data.items

Batch
  /batch/basic           Basic Batch — parallel requests, progress bar
  /batch/concurrency     Concurrency — concurrency: 2, queue visualisation
  /batch/settled         Settled Errors — settled: true, partial failures
  /batch/reactive        Reactive Getter — auto re-execute on source change

Cache
  /cache/ttl             TTL Cache — staleTime, cache hit badge, TTL timer
  /cache/swr             SWR — swr: true, revalidating ref, background fetch
  /cache/invalidation    Invalidation — invalidateCache, clearAllCache

Polling
  /polling/basic         Basic Polling — poll: 3000, request counter
  /polling/when-hidden   When Hidden — whenHidden: false, pause on hidden tab
  /polling/dynamic       Dynamic Interval — reactive interval via ref

Triggers
  /triggers/focus        Refetch on Focus — refetchOnFocus, throttle config
  /triggers/reconnect    Refetch on Reconnect — refetchOnReconnect, offline sim

Retry
  /retry/basic           Auto Retry — retry: 3, retryDelay, visual counter
  /retry/custom-codes    Custom Status Codes — retryStatusCodes: [429, 503]

Auth
  /auth/login            Login / Logout — live backend, Fill Demo Credentials
  /auth/refresh          Token Refresh — 401 queue, silent refresh visualised
  /auth/modes            Auth Modes — authMode: public / optional / default

State
  /state/mutate          Mutate — mutate(value), mutate(prev => ...)
  /state/reset           Reset — reset(), return to initialData
  /state/ignore-updates  Ignore Updates — ignoreUpdates(), suppress re-trigger

Devtools
  /devtools/kitchen-sink Kitchen Sink — 8-10 instances simultaneously
  /devtools/stress-test  Stress Test — 20+ parallel requests, Timeline load
  /devtools/errors       Error States — mixed 404 / 500 / 429 side by side
```

---

## Devtools Scenarios Detail

### Kitchen Sink (`/devtools/kitchen-sink`)
Runs simultaneously:
- 1× polling instance (3s interval)
- 1× SWR cache instance
- 1× lazy instance (manual trigger button)
- 1× batch (5 requests)
- 1× instance in error state (404)
- 1× instance loading (slow endpoint)
- 2× regular GET instances

Purpose: populate Instances tab, Network tab, Timeline all at once.

### Stress Test (`/devtools/stress-test`)
- Button "Fire 20 requests" — triggers `useApiBatch` with 20 URLs concurrently
- Button "Start 5 pollers" — starts 5 polling instances with different intervals
- Visualises request count, active instances

Purpose: Timeline tab performance, Network tab scrolling, circular buffer truncation.

### Error States (`/devtools/errors`)
- Grid of 6 instances, each configured to return a different status: 200, 404, 500, 429, 0 (network), aborted
- Each shows StatusBadge and full error detail

Purpose: StatusBadge rendering, error display in devtools, filter-by-status testing.

---

## Environment

```
# packages/playground/.env
VITE_API_URL=https://todo-list-backend-seven-mauve.vercel.app/api
VITE_AUTH_EMAIL=ametie@gmail.com
VITE_AUTH_PASSWORD=Password123!
```

"Fill Demo Credentials" button in Login demo pre-fills form from env vars — no manual typing during devtools development sessions.

---

## Sidebar Config (`app/routes/sidebar.ts`)

Built using `createSidebar()` from `@ametie/ui`:

```ts
export const sidebar = createSidebar({
  brandName: "vue-muza-use",
  storageKey: "playground-sidebar",
  persistCollapse: true,
  items: [
    { id: "core",    label: "Core",     children: [...] },
    { id: "batch",   label: "Batch",    children: [...] },
    { id: "cache",   label: "Cache",    children: [...] },
    { id: "polling", label: "Polling",  children: [...] },
    { id: "triggers",label: "Triggers", children: [...] },
    { id: "retry",   label: "Retry",    children: [...] },
    { id: "auth",    label: "Auth",     children: [...] },
    { id: "state",   label: "State",    children: [...] },
    { id: "devtools",label: "Devtools", children: [...] },
  ],
});
```

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vue | ^3.5 | Framework |
| Vue Router | ^4.x | Routing |
| Pinia | ^3.x | Auth demo store |
| @ametie/ui | workspace:* | UI components + sidebar |
| @ametie/config | workspace:* | Tailwind theme |
| @ametie/vue-muza-use | workspace:* | Library under test |
| Axios | ^1.x | HTTP client |
| Vite | ^6.x | Dev server + build |
| TypeScript | ~5.x | Type safety |

---

## Semver Impact

No impact on `@ametie/vue-muza-use` versioning. Playground and libs are `private: true` packages, never published.

---

## Out of Scope

- Auth guards / protected routes (playground is local dev only)
- Dark/light theme toggle (can be added later via `@ametie/ui` VThemeSwitcher)
- i18n
- Deployment / hosting
