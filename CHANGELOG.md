# Changelog

All notable changes to `@ametie/vue-muza-use` will be documented here.

Format: [Semantic Versioning](https://semver.org/)

> **Looking for pre-1.0 docs?** See the [v0.10.0 README](https://github.com/MortyQ/vue-muza-use/blob/v0.10.0/packages/use-api/README.md).

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
