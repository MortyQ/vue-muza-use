# useApiBatch Refactor — Design Spec

**Date:** 2026-05-27  
**Scope:** `packages/use-api/src/`  
**Files changed:** `useApiBatch.ts`, `useApi.ts`, `types.ts`

---

## Background

`useApiBatch` was introduced as a convenience wrapper around `useApi` for parallel multi-request scenarios. An audit of the implementation revealed four correctness bugs, one performance issue, and a missing feature gap compared to `useApi` (no `lazy` / auto-tracking, no `poll`). This refactor addresses all of them in a single, focused change.

---

## Bugs Fixed

### 1. Race condition in `execute()`

**Problem:** Calling `execute()` while a previous execution is in-flight leaves two executions running concurrently. The `abortControllers.value = []` at the top of `execute()` clears the list of controllers *without aborting them*, so in-flight requests from the previous run continue to completion and eventually overwrite `data`.

**Fix:** Check `loading.value` at the top of `execute()`. If `true`, call `abort()` before resetting state.

```ts
// top of execute(), before any reset
if (loading.value) {
  abort('Replaced by new execution');
}
```

---

### 2. `settled: false` — unlimited-concurrency path missing abort

**Problem:** In the `!limit || limit >= requests.length` branch, when a request fails and `!settled`, the code throws the error but never calls `abort()`. Remaining in-flight requests continue running, wasting network resources.

**Fix:** Call `abort()` before throwing.

```ts
if (!settled && !result.success && result.error) {
  abort('First request failed in non-settled mode');
  throw result.error;
}
```

---

### 3. `onFinish` not called after `settled: false` rejection

**Problem:** `onFinish` is called inside the `try` block. When `settled: false` and a request throws, execution jumps to `catch` — `onFinish` is never called.

**Fix:** Move `onFinish` to a `finally` block and track `finalResults` so it always fires with whatever completed before the failure.

```ts
let finalResults: BatchResultItem<T>[] = [];
try {
  finalResults = await executeWithConcurrency(currentRequests, concurrency);
  data.value = finalResults;
  // ... aggregated error logic ...
  return finalResults;
} catch (err) {
  if (!settled) error.value = err as ApiError;
  throw err;
} finally {
  loading.value = false;
  abortControllers.value = [];
  onFinish?.(finalResults); // always fires
}
```

---

### 4. External `signal` not chained to internal `AbortController` in `useApi`

**Problem:** `executeRequest()` passes `{ signal }` to `useApi`'s `execute()`. Inside `useApi.ts`, the call to `axios.request()` always uses `{ signal: controller.signal }` (the internal controller), ignoring the incoming `signal` entirely. The external signal is overwritten at the Axios level.

**Fix:** In `useApi.ts`, after creating the internal controller, add a one-time listener that forwards aborts from the external signal.

```ts
// in useApi.ts, right after: abortController.value = controller;
if (config?.signal && !config.signal.aborted) {
  config.signal.addEventListener('abort', () => {
    controller.abort(config.signal!.reason);
  }, { once: true });
}
```

This change has **no effect on normal `useApi` usage** — regular callers never pass `signal`.

---

## Performance Fix

### 5. `progress.total` recomputed inside `.then()` callbacks

**Problem:** `updateProgress()` calls `getRequests()` internally, which calls `toValue(requests).map(normalizeRequest)` on every progress tick. For large batches this runs O(n) extra normalization per completed item — O(n²) total.

**Fix:** Capture `total` once at the start of `execute()` and thread it into `updateProgress`.

```ts
const total = currentRequests.length;
updateProgress(0, 0, total);

// updateProgress signature change:
const updateProgress = (succeeded: number, failed: number, total: number) => { ... }
```

`executeWithConcurrency` receives `total` and passes it through to each `updateProgress` call.

---

## New: `lazy` option + auto-tracking

`useApi` defaults to `lazy: false`, meaning it auto-tracks reactive dependencies (url, params, data). `useApiBatch` had no equivalent — if you passed a `() => ...` getter for `requests`, you also had to manually wire up `watch`. This inconsistency is corrected.

**New default behavior (`lazy: false`):** When `requests` is a function (getter), `useApiBatch` wraps it in a `computed`, watches that computed for deep changes, and calls `execute()` automatically. Auto-tracking is scoped and cleaned up on scope dispose.

```ts
const { lazy = false, watch: watchSource, poll = 0, ...apiOptions } = options;

if (!lazy && typeof requests === 'function') {
  const trackingScope = effectScope();
  trackingScope.run(() => {
    const requestsComputed = computed(() =>
      (requests as () => BatchInput[])().map(normalizeRequest)
    );
    watch(requestsComputed, () => execute(), { deep: true });
  });
  if (getCurrentScope()) onScopeDispose(() => trackingScope.stop());
}
```

**Static arrays** (`lazy: false`, `requests` is an array or ref) — no auto-tracking, no change to behaviour.

**`lazy: true`** — disables auto-tracking entirely. Use this when you want full manual control via `execute()`.

**Also:** `lazy: true` should be added to the internal `useApi` call inside `executeRequest` — batch items are fire-once, not reactive:

```ts
const api = scope.run(() => useApi<T>(config.url, {
  ...apiOptions,
  method: config.method,
  data: config.data,
  params: config.params,
  useGlobalAbort: false,
  skipErrorNotification,
  lazy: true,  // batch items are fire-once; no auto-tracking needed
}))!;
```

---

## New: `poll` option for batch

Same type and semantics as `useApi`'s `poll`:

```ts
poll?: MaybeRefOrGetter<number | {
  interval: MaybeRefOrGetter<number>;
  whenHidden?: MaybeRefOrGetter<boolean>;
}>;
```

After `execute()` completes (in `finally`, after `loading.value = false`), if the batch was not aborted and `interval > 0`, schedule `setTimeout → execute()`. If `whenHidden` is false (default) and `document.hidden` is true, skip scheduling.

The `abort()` function clears `pollTimer` so polling stops when the scope is disposed or abort is called manually.

```ts
let pollTimer: ReturnType<typeof setTimeout> | null = null;

const getPollConfig = () => {
  const val = toValue(poll);
  if (typeof val === 'number') return { interval: val, whenHidden: false };
  return {
    interval: toValue((val as { interval: MaybeRefOrGetter<number> }).interval),
    whenHidden: toValue((val as { whenHidden?: MaybeRefOrGetter<boolean> }).whenHidden) ?? false,
  };
};

// in execute() finally, after loading.value = false:
if (!isAborted) {
  const { interval, whenHidden } = getPollConfig();
  if (interval > 0) {
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (whenHidden || !hidden) {
      pollTimer = setTimeout(() => { pollTimer = null; execute(); }, interval);
    }
  }
}

// in abort():
if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
```

---

## Deprecation: `watch` option

The `watch` option remains functional but is marked `@deprecated` in JSDoc. IDEs show a strikethrough. It will be removed in v2.0.

**Migration path:**  
```ts
// Before (deprecated)
useApiBatch(() => ids.value.map(id => `/items/${id}`), { watch: ids })

// After (preferred)
useApiBatch(() => ids.value.map(id => `/items/${id}`))
// auto-tracking fires execute() whenever ids.value changes
```

---

## Types changes (`types.ts`)

`UseApiBatchOptions` additions:

```ts
/**
 * Disable auto-tracking. When true, reactive changes to the `requests` getter
 * will NOT trigger re-execution. Use when you want full manual control via execute().
 * Default: false
 */
lazy?: boolean;

/**
 * Polling interval in ms, or advanced config object.
 * Same semantics as UseApiOptions.poll.
 */
poll?: MaybeRefOrGetter<number | {
  interval: MaybeRefOrGetter<number>;
  whenHidden?: MaybeRefOrGetter<boolean>;
}>;

/**
 * @deprecated Use a reactive getter for `requests` with lazy: false (default).
 * Auto-tracking will re-execute when the getter's dependencies change.
 * This option will be removed in v2.0.
 */
watch?: WatchSource | WatchSource[];
```

---

## Summary of changes

| # | File | Change | Type |
|---|------|---------|------|
| 1 | `useApiBatch.ts` | Abort on race condition at top of `execute()` | Bug fix |
| 2 | `useApiBatch.ts` | Abort in unlimited-concurrency `settled:false` path | Bug fix |
| 3 | `useApiBatch.ts` | Move `onFinish` to `finally` | Bug fix |
| 4 | `useApi.ts` | Chain external signal to internal AbortController | Bug fix |
| 5 | `useApiBatch.ts` | Cache `progress.total` once per execution | Perf fix |
| 6 | `useApiBatch.ts` | `lazy: true` on internal `useApi` call | Perf fix |
| 7 | `useApiBatch.ts` | `lazy` option + auto-tracking for getter requests | New feature |
| 8 | `useApiBatch.ts` | `poll` option | New feature |
| 9 | `useApiBatch.ts` | `watch` option marked `@deprecated` | Deprecation |
| 10 | `types.ts` | Add `lazy`, `poll`; deprecate `watch` on `UseApiBatchOptions` | Types |

---

## What is NOT changing

- `useApi.ts` behavior for all existing callers — the signal chain only fires when a `signal` is explicitly passed, which normal `useApi` usage never does.
- `UseApiBatchReturn` interface — no new return values.
- `immediate` option — unchanged.
- `concurrency` limiting logic — unchanged.
- Error aggregation, `settled` semantics — unchanged.
- The `watch` option — still works; just deprecated.

---

## Testing

New test cases needed (in addition to existing suite):

1. Race condition: call `execute()` twice rapidly; first execution aborts, second wins.
2. `settled: false` + unlimited concurrency: first failure aborts remaining requests.
3. `onFinish` fires after `settled: false` rejection with partial results.
4. External signal: pass an AbortController signal; aborting it cancels the useApi-level request.
5. `lazy: false` + getter: changing a reactive dep re-runs execute automatically.
6. `lazy: true` + getter: changing a reactive dep does NOT trigger execute.
7. `poll`: execute fires again after the interval; abort clears the timer.
8. `poll` with `whenHidden: false`: no re-execute when tab is hidden.
9. `watch` deprecation: still functions, but TypeScript shows `@deprecated` warning.
