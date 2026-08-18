# `useApiBatch`

Parallel batch requests: wrapper shape, component usage, the batch-only options, and the
`useApi` options a batch accepts.

```ts
// src/features/users/api/useUsersRequest.ts
import {useApiBatch, type UseApiBatchOptions} from "@ametie/vue-muza-use";
import type {User} from "@/features/users/types";

export default () => {
    // Bulk delete by IDs
    const bulkDeleteUsers = (ids: number[], options?: UseApiBatchOptions<void>) =>
        useApiBatch<void>(ids.map(id => ({url: `/users/${id}`, method: 'DELETE'})), options);

    // Fetch multiple items by IDs — reactive getter auto-tracks deps
    const fetchUsersByIds = (getIds: () => number[], options?: UseApiBatchOptions<User>) =>
        useApiBatch<User>(() => getIds().map(id => `/users/${id}`), options);

    return {bulkDeleteUsers, fetchUsersByIds};
};
```

```ts
// component
const {bulkDeleteUsers, fetchUsersByIds} = useUsersRequest();

// Bulk delete
const {loading, execute: deleteAll} = bulkDeleteUsers(selectedIds.value, {
    onFinish: (results) => reload(),
});

// Reactive batch — re-executes when watchedIds changes
const {successfulData: users, loading: usersLoading} = fetchUsersByIds(
    () => watchedIds.value,  // auto-tracked, no lazy:true needed
);
```

`useApiBatch` also accepts `concurrency` (worker-pool limit on parallel requests),
`progress` (a `Ref` tracking `{ completed, total }` as items finish), and `settled`
(when `true`, non-2xx results land in the results array instead of throwing —
useful for "delete what we can, report the rest" bulk flows).

## `useApi` options a batch accepts

| Option | Behavior in a batch |
|---|---|
| `cache: true \| { staleTime, swr, freshFor }` | Caches **each request separately** under an auto key (`method + url + params + data`). A batch of 3 URLs makes 3 entries; an overlapping re-run serves the overlap from cache. With `swr: true` see below |
| `invalidateCache` | Runs after each request in the batch that returns 2xx |
| `select` | Applied per item — `data`, `successfulData` and `onItemSuccess/onItemError` all get the transformed value |
| `refetchOnFocus` / `refetchOnReconnect` | Re-execute the **whole** batch. One listener per batch, not per request. **Not** inherited from `globalOptions` — a batch opts in explicitly |
| `retry` / `retryDelay` / `retryStatusCodes` | Per request, same semantics as `useApi` |

```ts
// Cache + select — second generic is the raw response type before select
const fetchUsersByIds = (getIds: () => number[]) =>
    useApiBatch<User, { data: User }>(
        () => getIds().map(id => `/users/${id}`),
        {cache: {staleTime: '5m'}, select: (res) => res.data},
    );
// ids [1,2,3] -> [2,3,4]: only /users/4 hits the network
```

Not accepted, on purpose — do not try to pass them:

- `cache: 'key'` / `cache: { id }` — every request in the batch would share one entry, so
  items 2..N would read the first item's data. Batch caching is always auto-keyed.
- `coalesce` — no-op inside a batch: the internal `useApi` instances are `lazy: true` and
  driven manually, while coalescing hangs off auto-tracking.

## Incremental results and SWR (1.8.2+)

`data` is always the length of the requests array and is filled in **as items land** — each
item carries `status: 'pending' | 'success' | 'error'` and `stale: boolean`. A slow request
no longer holds up the fast ones on screen.

`cache: { swr: true }` builds on that: cached items are published before the first network
round trip, then refreshed in the background.

```ts
const {data, loading, revalidating} = useApiBatch<User>(
    () => ids.value.map(id => `/users/${id}`),
    {cache: {swr: true, staleTime: '1d', freshFor: '5m'}, immediate: true},
);
// t=0   data = [u1(stale), u2(stale), pending]   loading: true (one miss), revalidating: true
// t=300 data = [u1, u2, u3]                      loading: false, revalidating: false
```

- `loading` — `true` only while some item has no data at all. An all-cached batch never
  flips it; use `revalidating` for the background refresh.
- Callbacks and `progress` follow the **final** state: the stale publish fires nothing, and
  an SWR item counts as completed only once its refresh settles.
- A failed revalidation is still a failure — `status: 'error'`, error in `errors` and
  `onItemError`, item dropped from `successfulData` — but `data` keeps the cached value with
  `stale: true`, so the UI can show the old value next to the error. Render on `stale`, not
  on `error === null`.
