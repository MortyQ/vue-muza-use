# Changelog

All notable changes to `@ametie/vue-muza-use` will be documented here.

Format: [Semantic Versioning](https://semver.org/)

> **Looking for pre-1.0 docs?** See the [v0.10.0 README](https://github.com/MortyQ/vue-muza-use/blob/v0.10.0/packages/use-api/README.md).

---

## [1.5.5] — Unreleased

### Fixed

#### `@ametie/vue-muza-use`

- **Per-call `execute()` config leaked into axios requests** — `cache`, `invalidateCache`, `retry`, `retryDelay`, `retryStatusCodes`, `skipErrorNotification`, and the lifecycle callbacks passed to `execute({...})` were spread raw into `axios.request()`, making them visible in `response.config`, interceptors, and devtools records. They are now filtered out before the request is sent. `select` was also removed from `ExecuteConfig`'s type (it was silently ignored at runtime — a setup-time-only option), and `execute()`'s return type no longer claims an impossible `undefined`.
- **Devtools instance-event queue grew unbounded when devtools was disabled** — every `useApi()` call (amplified by `useApiBatch`, one instance per item per execution) permanently retained a closure in a pending-events queue that was only ever flushed if devtools was configured. The queue is now a `Map` keyed by instance id, only populated when devtools is expected, and a bridge-construction failure degrades to the same no-op behavior as devtools being absent instead of leaking forever. The devtools state-watch (`deep: true`) also no longer runs at all when devtools is disabled.
- **Token-refresh requests were invisible in devtools** — the refresh POST fires inside the axios response interceptor, entirely bypassing `useApi`'s instrumentation, so a 401'd request appeared stuck "pending" for the whole refresh+replay with no explanation. It's now recorded as a standalone devtools entry (`instanceId: null`), with payload/response/error-details passed through a recursive redactor (`token`/`jwt`/`bearer`/`secret`/`password`/`authorization`/`apiKey`/`session`, case-insensitive) so no credential — including nested response shapes and refresh-failure error bodies — ever reaches devtools history.
- **`poll` visibilitychange listener registered for every instance** — every `useApi()` call added a `document` listener for poll catch-up-on-focus, even when `poll` was never configured. The listener is now only registered when polling is actually configured.
- **`initialLoading` never fell back to `immediate`** — `initialLoading` defaulted to `false` at destructure time, so the intended `initialLoading ?? immediate` fallback was dead code. With `immediate: true` and a `debounce`, `loading` stayed `false` during the initial debounce window since the deferred `execute()` hadn't set it yet. `initialLoading` now correctly defaults to `immediate`'s value when not explicitly set.
- **Refresh-endpoint detection by substring** — the 401 handler used `url.includes(refreshUrl)` to detect a failed refresh, so a 401 from an unrelated endpoint like `/auth/refresh-devices` was misclassified as the refresh endpoint itself, incorrectly clearing tokens. Detection now requires an exact path match or a `/`-anchored suffix match.
- **`useAbortController().signal` went stale after the first `abort()`** — `signal` was a one-time snapshot taken at call time; after `abort()` swapped in a new controller, `signal.value` stayed pointed at the old, permanently-aborted signal forever — silently breaking any consumer following the composable's own documented usage pattern. `signal` is now a `computed` that re-derives from the current controller on every `abort()`. `isAbortError` also now recognizes axios `CanceledError`/`ERR_CANCELED`, not just DOM `AbortError`.
- **`localStorage` access could crash the request interceptor** — Safari private mode and storage-blocked iframes throw on any `localStorage` access; that exception previously propagated straight out of the interceptor and broke every request. Token storage now degrades to "no token" on read failures and no-ops on write failures instead of throwing.

### Improved

#### `@ametie/vue-muza-use`

- **`params` decoupled from the request-body type** — `ApiRequestConfig<D>`'s `params` field shared the request-body generic `D`, so a typed POST body forced correctly-shaped query params into a type error. `params` now has its own independent generic (default `unknown`).

---

## [1.5.4] — 2026-07-02

### Improved

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **KV tree object/array preview** — collapsed objects now show a Chrome-style preview of the first 3 `key: value` pairs (e.g. `{id: 1, name: "Anna", …}`) instead of the opaque `Object {3}` badge. Collapsed arrays keep the `Array [n]` length prefix but add a preview of the first 2 elements (e.g. `Array [3] [1, 2, …]`). Long string values are truncated to 20 characters within the preview.
- **`undefined` values in the KV tree** — object keys with an `undefined` value are now hidden from both the preview and the expanded tree, and `undefined` array items render as `null` — matching `JSON.stringify` semantics so the KV view no longer shows fields the JSON view silently drops.
- **KV toggle icon** — the `KV` text button on the Payload and Response panes is now a `list-tree` icon with a descriptive tooltip ("Switch to JSON view" / "Switch to Key-Value view").

### Fixed

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **Payload pane empty space** — the `Query Params` and `Body` sections were each hardcoded to `max-height: 50%`, regardless of whether the other section had content. When only one was present, the pane left half its height empty (and scrolled unnecessarily) instead of letting that section fill the available space.
- **Settings menu click-outside** — the settings-menu backdrop was rendered via `<Teleport to="body">`, placing it in a lower stacking context than the panel itself (`z-index: 99` vs. the panel's `z-index: 99998`). Clicks anywhere inside the panel never reached the backdrop, so the menu only closed when clicking the host page outside the panel entirely. The backdrop now renders in the panel's own stacking context, so any click inside the panel (besides the menu) closes it.

---

## [1.5.1] — 2026-06-20

### Fixed

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **Shadow DOM CSS isolation** — the devtools panel is now mounted inside a Shadow DOM root in production builds. Consumer global CSS (element resets, `*` rules, `line-height`, `font-size`, etc.) can no longer leak into the panel. All styles (Tailwind utilities + scoped component CSS) are collected via `cssInjectedByJs` into `window.__vmdPendingCss` and injected into the shadow root at mount time. Dev mode (Vite source aliases) continues to mount directly with CSS in `<head>` as before.
- **Inherited property reset** — added `line-height: normal` and `font-size: 16px` on `:host` / `#vue-muza-devtools-root` to reset inherited CSS properties that flow into the shadow tree from the consumer document.
- **Badge font size independent of consumer root** — rewrote `Badge.vue` with explicit `px` units in scoped CSS instead of Tailwind `text-xs` (`0.75rem`). `rem` resolves against the outer document `:root`, so a consumer with a non-default `font-size` caused badges to render oversized inside shadow DOM. Now always renders at `11px` regardless of consumer typography.
- **Request row fixed height** — changed `.request-row` from `min-height: 52px` to `height: 52px` with `overflow: hidden` to match the virtualizer's `estimateSize`. Previously the active row could grow taller than its allocated slot, causing visual overlap with adjacent rows.

---

## [1.3.1] — Unreleased

### Fixed

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **PayloadPane format toggle test isolation** — the module-scope `_payloadFormatLoaded` singleton caused the `loadPayloadFormat` call to be skipped in subsequent tests within the same file. Fixed by switching the format-toggle describe block to `vi.resetModules()` + `vi.doMock()` + dynamic import so each test gets a fresh module instance.

---

## [1.3.0] — 2026-06-18

### Added

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **Error banner in Response tab** — when a request fails, a red banner appears at the top of the Response pane showing the HTTP status code and error message. The banner coexists with the response body (shown below it), so 4xx/5xx responses that include a body (e.g. `422 { errors: [...] }`) show both.
- **Response tab error indicator** — the Response tab label turns red and shows a `●` dot when the selected request has an error. Applies to both the standalone Response tab and the Split view.
- **`ApiError.details` in devtools** — the server response body for failed requests is now captured and displayed in the Response pane body viewer (with the existing KV / JSON toggle). Previously only the error message was shown.
- **Semantic filter pill colors** — the status filter pills now use semantic colors in both inactive and active states: Success → green, Error → red, Pending → yellow, Aborted → neutral. Active state border and background match the pill's semantic color instead of always using the primary purple.

### Improved

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **Empty state text legibility** — "No params" and "No body" placeholders in the Payload pane are now rendered at `--dt-foreground-secondary` (65% lightness) instead of `--dt-foreground-subtle` (38%), making them clearly readable against the dark background.

### Fixed

#### `@ametie/vue-muza-use`

- **Network / timeout error code lost** — `parseApiError` now preserves the axios error `code` (`ERR_NETWORK`, `ECONNABORTED`, etc.) for errors that have no response (network failures, timeouts, CORS). Previously this field was silently dropped, leaving `code: undefined` on the returned `ApiError`.

---

## [1.2.0] — 2026-06-16

### Added

#### DevTools Panel (`@ametie/vue-muza-devtools`)

- **DevTools panel** — a Vue 3 devtools panel for inspecting `useApi` instances and network requests in real-time. Included with the library; zero impact on production builds when disabled.
- **`devtools` option on `createApi`** — enable the panel by passing `devtools: { enabled: true }`. Gate it on `NODE_ENV` to keep production builds clean:
  ```ts
  app.use(createApi({
    axios: api,
    devtools: { enabled: process.env.NODE_ENV !== 'production' }
  }))
  ```
- **Network tab** — live request history with URL, status, and instance filtering. Inspect request payload, response body, headers, and timing for every `useApi` call.
- **`maxHistory`** — maximum number of requests kept in history. Default: **300**.
- **`maxPayloadSize`** — maximum bytes per payload/response before truncation. Default: **200 000**.

---

## [1.1.1] — 2026-05-27

### Fixed
- Corrected `globalOptions.refetchOnFocus` / `refetchOnReconnect` configuration examples in README.

---

## [1.1.0] — 2026-05-27

### Added — `useApiBatch`

- **`BatchRequestConfig`** — per-request `method`, `data`, `params`, and `headers`. Pass config objects instead of (or alongside) plain strings. Default method is `GET`. Strings and objects can be mixed in the same array.
- **`lazy` option** (`boolean`, default `false`) — when `requests` is a getter function, the batch re-executes automatically whenever the getter's reactive dependencies change. Set `lazy: true` to disable auto-tracking and keep full manual control via `execute()`.
- **`poll` option** — same semantics as `useApi`'s `poll`. After each completed execution, schedules the next one after `interval` ms. Skips scheduling when `whenHidden: false` (default) and the tab is hidden.
- `BatchResultItem.request` — the normalized `BatchRequestConfig` that produced each result.
- `BatchResultItem.response` — the full `AxiosResponse<T>` object; access response headers here.

### Changed — `useApiBatch`

- **`watch` option deprecated** — use a reactive getter for `requests` with `lazy: false` (default) instead. Auto-tracking fires `execute()` automatically when the getter's dependencies change. The option still works and will be removed in v2.0.

### Fixed — `useApiBatch`

- **Race condition in `execute()`** — calling `execute()` while a previous run was in-flight caused both executions to run concurrently; the older run could overwrite `data` after the newer one completed. The previous run is now aborted before starting a new one.
- **`settled: false` missing abort** — in the unlimited-concurrency path, a failed request now aborts sibling requests before throwing. Previously, sibling requests kept running after the first failure.
- **`onFinish` not called after `settled: false` rejection** — `onFinish` is now in `finally` and always fires with the results accumulated before the failure.

### Fixed — `useApi`

- **External `signal` ignored by Axios** — the `signal` passed to `execute({ signal })` is now forwarded to the internal `AbortController`. Previously, `axios.request()` used only the internal controller's signal; the external one was silently discarded. This affected `useApiBatch` per-item cancellation.

### Performance — `useApiBatch`

- `progress.total` is now captured once at the start of `execute()` instead of being recomputed inside every `.then()` callback. Previously O(n) per completion, O(n²) total for large batches.

---

## [1.0.0] — 2026-04-17

### Breaking Changes
- **`watch` option removed** from `UseApiOptions`. `url`, `params`, and `data` are now auto-tracked — the request re-fires automatically when their reactive dependencies change. No explicit `watch` needed.
- **`staleWhileRevalidate` option removed** from `UseApiOptions`. Moved into `CacheOptions` as `swr: boolean`. Use `cache: { id: 'key', swr: true }` instead of `cache: 'key', staleWhileRevalidate: true`.
- **`peerDependencies`**: minimum Vue version bumped from `^3.3.0` to `^3.5.0` (required for `effectScope.pause/resume`).

### Added
- `lazy?: boolean` — opt-out of auto-tracking. When `true`, reactive changes to `url`, `params`, and `data` do NOT trigger a re-fetch. Use for forms and manual mutations where you call `execute()` yourself.
- `refetchOnFocus?: boolean | { throttle?: number }` — re-fetch when the browser tab regains focus. Default throttle: 60 000ms. Pass `{ throttle: 0 }` to always refetch. Configurable globally via `createApiClient({ globalOptions: { refetchOnFocus: true } })`.
- `refetchOnReconnect?: boolean` — re-fetch when the browser regains network connectivity (`online` event). No throttle applied. Configurable globally.
- `CacheOptions.swr?: boolean` — replaces the top-level `staleWhileRevalidate` option.

### Migration from 0.x

```ts
// watch → auto-tracking
// Before
useApi('/products', {
  params: () => ({ q: search.value }),
  watch: [search],
})
// After
useApi('/products', {
  params: () => ({ q: search.value }),
})

// staleWhileRevalidate → cache.swr
// Before
useApi('/users', { cache: 'users', staleWhileRevalidate: true })
// After
useApi('/users', { cache: { id: 'users', swr: true } })

// New: refetchOnFocus
useApi('/dashboard', { refetchOnFocus: true })

// New: global config
createApiClient({
  globalOptions: { refetchOnFocus: true, refetchOnReconnect: true }
})

// Form (opt-out of auto-tracking)
useApi('/products', {
  data: form,
  lazy: true,
})
```

### Changed
- `ignoreUpdates` internally migrated from a boolean flag to `effectScope.pause()/resume()`. External API is unchanged.

---

## [0.10.0] — 2026-04-16

### Added
- `select` option — transform response data before storing in `data`. Third generic `TSelected` on `UseApiOptions<T, D, TSelected>`.
- `staleWhileRevalidate` option — serve cached data instantly while revalidating in the background. Exposes `revalidating` ref.
- `withCredentials` option — per-request override of Axios credential behavior.
- `revalidating` ref in `UseApiReturn` — indicates background SWR revalidation in progress.

### Changed
- `UseApiReturn.response` type changed to `Ref<AxiosResponse<unknown> | null>` to decouple from response generic.
- Repository renamed from `vue-useApi` to `vue-muza-use`.

---

## [0.9.2] — 2026-04-16

### Added
- Full test coverage (100+ tests).
- Documentation rewrite.
- Claude Code skill for feature-scoped API layer pattern.

---

## [0.9.1] — 2026-04-10

### Fixed
- Cache documentation.

---

## [0.9.0] — 2026-04-10

### Added
- `cache` option — in-memory response cache with configurable TTL.
- `invalidateCache` option — bust related caches on mutation success.

---

## [0.8.0] — 2026-04-09

### Added
- `ignoreUpdates` — update watched refs without triggering a re-fetch.

---

## [0.7.0] — 2026-04-09

### Added
- Retry logic with configurable `retry` and `retryDelay`.

---

## [0.6.1] — 2026-03-15

### Changed
- Renamed `setData` to `mutate`.

---

## [0.6.0] — 2026-02-13

### Added
- Batch requests (`useApiBatch`) — parallel requests with combined loading state and progress tracking.

---

## [0.5.0] — 2026-02-11

### Added
- `mutate` (formerly `setData`) — manually set `data` value without a network request.

---

## [0.1.0] — 2026-02-05

### Added
- Auto-refetch on reactive dependency change (`watch` option).

---

## [0.0.4] — 2026-02-04

### Added
- Initial public release.
- `useApi`, `useApiGet`, `useApiPost`, `useApiPut`, `useApiPatch`, `useApiDelete`.
- Axios interceptor integration for auth token refresh.
- `immediate`, `debounce`, `poll` options.
- `execute`, `cancel` controls.
- Race condition prevention.
- Automatic cleanup on component unmount.
