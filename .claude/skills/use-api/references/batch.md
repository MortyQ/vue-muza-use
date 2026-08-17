# `useApiBatch`

Parallel batch requests: wrapper shape, component usage, and the three batch-only options.

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
