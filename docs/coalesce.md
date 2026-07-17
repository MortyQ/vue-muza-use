# Trigger Coalescing (`coalesce`) — what changed in 1.7.0 and why

## The problem

`useApi` auto-refetches when reactive deps inside the `url` / `params` / `data`
getters change. Before 1.7.0 the internal watcher called `execute()`
**synchronously on every trigger**. Vue runs watchers one after another inside a
single flush — so when one logical update mutated several deps, the library's
watcher could run more than once per flush:

```ts
const page = ref(1);
const sort = ref<SortItem[]>(defaultSort);

const { data, loading } = fetchTable({
    data: () => ({ ...filters.value, page: page.value, sort: sort.value }),
    immediate: true,
    cache: true,
});

// One filter change → TWO requests before 1.7.0:
//   1. internal watcher fires with the NEW filters but OLD page/sort
//   2. this watch resets page/sort → watcher re-fires → second request
watch(filters, () => {
    sort.value = defaultSort;
    page.value = 1;
});
```

Consequences of the old behavior:

- **The backend received every duplicate.** The earlier request was aborted
  client-side, but it was already on the wire — heavy POST search endpoints ran
  twice per filter change.
- **Cache pollution** with `cache: true`: the doomed request read/keyed the
  cache under a transient auto key that would never be used again, and
  `cacheKey` flickered between keys.
- **`ignoreUpdates` was order-dependent.** Wrapping the reset in
  `ignoreUpdates` either sent one request with *stale* page/sort (composable
  declared first) or sent *no request at all* (user watch declared first).
  Correctness hung on the order of two lines in `setup()`.
- A manual `execute()` called right after a dep mutation was **aborted by the
  catching-up auto-trigger**, silently dropping its per-call config
  (`skipErrorNotification`, extra payload, per-call `onSuccess`, …).

## What 1.7.0 does

The internal watcher no longer executes immediately. It marks the instance
dirty and defers **one** `execute()` to `nextTick` — after the entire flush,
including every cascading watcher, has finished. Payload getters were always
resolved at send time, so the single request carries the **final** values.

```
filters change ──▶ watcher #1 (reset page/sort) ─┐
                   watcher #2 (useApi, marks dirty) ─┤  same flush
                   watcher #2 re-queued (deps changed) ┘
                                        │
                                nextTick: ONE request
                                { search: "abc", page: 1, sort: defaultSort }
```

Covered trigger sources: auto-tracking (`url`/`params`/`data` getters), the
`immediate: true` initial request, and dynamic `poll` config changes. Poll
*ticks*, `refetchOnFocus`/`refetchOnReconnect`, and retries are time-spaced
events and are not coalesced.

Manual `execute()` is never coalesced — and it now **supersedes** pending
auto-triggers instead of being aborted by them:

```ts
status.value = "active";
await execute({ skipErrorNotification: true });
// 1.7.0: exactly one request (the manual one, config intact).
// Before: the auto-trigger aborted it a microtask later.
```

## What does NOT change

- `data` is never cleared during a refetch — it keeps the previous response
  until the new one lands (same as before).
- Visible loading states and painted frames are identical: the deferral is a
  microtask, and browsers paint only after the microtask queue drains, so no
  frame ever renders "filters changed but no spinner".
- First-load behavior: `loading` is still preset synchronously by
  `initialLoading ?? immediate`.
- The public API surface: purely additive (`coalesce` option); `UseApiReturn`
  and `execute()`'s signature are untouched.

## Opting out

```ts
// Per request
fetchTable({ data: () => ({ ...}), coalesce: false });

// App-wide (per-request value wins)
createApi({ axios, globalOptions: { coalesce: false } });
```

`coalesce: false` restores the pre-1.7 per-trigger behavior exactly. In
development it also enables a one-time warning when ≥2 auto-triggers fire
within one tick, pointing at the reset-watch pattern.

## Migration notes

- **Apps:** nothing to do. Reset-watches (`watch(filters, () => { page.value = 1; … })`)
  are now safe by default, in any declaration order.
- **Unit tests:** assertions made *synchronously* after a dep mutation (or
  right after mount with `immediate: true`) observe the state before the
  deferred send. Add `await nextTick()` (fake timers) or
  `await flushPromises()` (real timers) before asserting call counts or
  captured requests. No assertion values change — only the awaited timing.
- **Edge case to know:** the `immediate` initial send coalesces with same-tick
  dep mutations on a best-effort basis. If no flush is pending at setup time,
  you may still see one extra aborted request — a graceful degradation to the
  old behavior, never a wrong payload.

## Related

- README → options table (`coalesce`) and the "Trigger coalescing" section.
- `CHANGELOG.md` → 1.7.0 entry.
- Implementation plan (internal): `docs/superpowers/plans/2026-07-16-coalesce-auto-triggers.md`.
