# Skill: Vue Muza Use API Layer

## Metadata

| Field | Value |
|---|---|
| **name** | `use-api` |
| **description** | Feature-scoped API layer pattern built on `@ametie/vue-muza-use`. Generates and refactors typed composable wrappers for HTTP requests in Vue 3 apps. |
| **version** | 1.6 |
| **applies_to** | `**/api/use*.ts`, `**/*.vue`, `**/*.ts` (when dealing with HTTP requests) |
| **verified_against** | `@ametie/vue-muza-use` 1.7.0 (coalesced auto-triggers) |

## Auto-Activation Triggers

Apply this skill automatically when any of the following is true:

- The task involves creating or editing a file matching `*/api/use*.ts`
- The code imports or mentions `useApiPost`, `useApiGet`, `useApiPut`, `useApiDelete`, `useApiPatch`
- The code imports from `@ametie/vue-muza-use`
- The user asks to: "create an API layer", "add a request", "fetch data from", "add a download", "create a composable for API", "wrap an endpoint"
- The component directly calls `useApi*` — this is a violation, suggest refactoring to a feature wrapper

---

## Role

You are a senior Vue 3 / TypeScript / frontend architecture assistant.
Your job is to generate and refactor feature-scoped API layers built on top of `@ametie/vue-muza-use`.

You must optimize for:
- clean architecture,
- typed API wrappers,
- composable-based usage,
- real-world Vue app patterns,
- minimal duplication,
- predictable naming,
- production-ready code.

Do not write raw HTTP logic directly in components when a feature API layer is appropriate.

---

## Core idea

This codebase uses a feature API wrapper pattern:

- Components do not call `useApiPost` / `useApiGet` directly.
- Components call a feature composable like `useProducts()` or `useOrders()`.
- That composable returns typed request factories such as:
  - `fetchProducts`
  - `saveProduct`
  - `downloadProducts`
  - `deleteProduct`
- Those factories internally call `useApi*` with:
  - explicit URL,
  - explicit response typing,
  - optional request typing when needed.

All runtime request behavior is passed from the component into the returned factory call:
- `data`
- `params`
- `immediate`
- `lazy`
- `debounce`
- `responseType`
- `onSuccess`
- `onError`
- `poll`
- `retry`
- `skipErrorNotification`
- `cache` / `invalidateCache`
- `refetchOnFocus`
- `refetchOnReconnect`
- `select`
- `withCredentials`

For one-off behavior on a single `execute()` call, pass `ExecuteConfig` directly to `execute()` instead of the composable options — see [execute() per-call overrides](#execute-per-call-overrides) below.

---

## Auto-tracking (IMPORTANT)

`useApi` automatically re-fetches when reactive dependencies inside the `url`,
`params`, or `data` getters change. There is **no `watch` option** — passing one
is a TypeScript error. This replaced an older `watch: [...]` API; if you see
`watch` in existing code or in generated examples elsewhere, it is stale.

- **Reads (GET):** pass getters, get auto-refetch for free. `immediate: true`
  fires the initial request.
- **Mutations (POST/PUT/PATCH/DELETE) and manual requests:** ALWAYS pass
  `lazy: true`. Without it, a reactive `data: () => form.value` getter fires
  the mutation on every form edit (auto-tracking is `lazy: false` by default
  for every method, not just GET).
- **Coalescing (1.7+):** multiple dep changes in one flush (filter change +
  a watch resetting `page`/`sort`) send ONE request with the final values —
  reset-watches are safe by default. Opt out with `coalesce: false`.
- **Escape hatch:** `ignoreUpdates(() => { ... })` (from the composable's
  return) mutates reactive deps without triggering a request at all
  (synchronous changes only).

```ts
// ✅ read — auto-tracked
const { data } = fetchProducts({
  params: () => ({ page: page.value }),
  immediate: true,
});

// ✅ mutation — lazy + manual execute()
const { execute } = saveProduct({
  data: () => form.value,
  lazy: true,
});
```

---

## Required file structure

```
/feature/<FeatureName>/api/use<FeatureName>.ts
```

Example:

```
/feature/products/api/useProducts.ts
/feature/orders/api/useOrders.ts
/feature/users/api/useUsers.ts
```

This file exports one composable that returns all request factories for that domain.

---

## Naming rules

| Prefix | Purpose |
|---|---|
| `fetch...` | data reads |
| `download...` | blob / file exports |
| `save...` | create actions |
| `update...` / `edit...` | mutation / update actions |
| `delete...` | delete actions |

Prefer descriptive domain names. Avoid vague names like `requestData`, `loadStuff`, `handleApi`.

---

## API layer pattern

### Correct pattern

```ts
import { useApiGet, useApiPost, useApiDelete, UseApiOptions } from "@ametie/vue-muza-use";
import type { Product } from "@/features/products/types";

export default () => {
  const fetchProducts = (options?: UseApiOptions<Product[]>) =>
    useApiGet("/products", options);

  const fetchProduct = (id: number, options?: UseApiOptions<Product>) =>
    useApiGet(`/products/${id}`, options);

  const saveProduct = (options?: UseApiOptions<Product>) =>
    useApiPost("/products", options);

  const downloadProducts = (options?: UseApiOptions<Blob>) =>
    useApiPost("/products/export", options);

  const deleteProduct = (id: number, options?: UseApiOptions<void>) =>
    useApiDelete(`/products/${id}`, options);

  return {
    fetchProducts,
    fetchProduct,
    saveProduct,
    downloadProducts,
    deleteProduct,
  };
};
```

### Important rules
- Keep `useApi*` inside the feature API wrapper — never in components.
- Keep URL and response typing inside the wrapper.
- Keep runtime options in the component.
- Do not duplicate request implementation across components.

---

## Component usage pattern

```ts
const { fetchProducts, downloadProducts } = useProducts();

const page = ref(1);
const sort = ref({ field: "createdAt", order: "desc" });
const filters = ref({ status: "active", search: "" });

const { loading, data } = fetchProducts({
  params: () => ({
    ...filters.value,
    page: page.value,
    sort: sort.value,
  }),
  immediate: true,
});

const { loading: downloadLoading, execute: download } = downloadProducts({
  params: () => ({ ...filters.value, sort: sort.value }),
  responseType: "blob",
  onSuccess: downloadFromResponse,
});
```

Pattern order:
1. feature composable first
2. per-request options in the component
3. destructured state from the return

---

## UseApiOptions guidance

`UseApiOptions` accepts up to three generics: `UseApiOptions<TRaw, D, TSelected>`.

Use `UseApiOptions<Response>` by default.

Only include additional generics when they genuinely improve clarity:

```ts
// preferred — single generic in most cases
UseApiOptions<ResponseShape>

// second generic only when request body type matters
UseApiOptions<ResponseShape, RequestBody>

// third generic only when select transforms the response type
UseApiOptions<RawResponse, unknown, SelectedType>
```

---

## execute() per-call overrides

`execute(config?)` accepts `ExecuteConfig` — a subset of `UseApiOptions` that applies to **that call only**. Composable-level options are unchanged for subsequent calls.

**Lifecycle callbacks merge** (both fire, composable → per-call).  
**All other options replace** the composable-level value.

```ts
// feature API wrapper (composable-level — always runs)
const saveProduct = (options?: UseApiOptions<Product>) =>
  useApiPost('/products', {
    invalidateCache: 'products-count',
    onSuccess: () => refreshList(),
    ...options,
  });

// component — per-call additions
const { execute } = saveProduct();

// Both onSuccess handlers fire; only 'products-list' is invalidated on this call
await execute({
  data: { name: 'New item' },
  onSuccess: () => toast('Product created!'),
  invalidateCache: 'products-list',
});

// Silence error notification for this specific call
await execute({
  data: { name: 'Risky item' },
  skipErrorNotification: true,
});
```

**Per-call overridable options:**
- Request: `data`, `params`, `headers`, `method`, `authMode`, `withCredentials`
- Caching: `cache` (replace), `invalidateCache` (replace)
- Retry: `retry`, `retryDelay`, `retryStatusCodes`
- Error: `skipErrorNotification`
- Lifecycle (merge): `onBefore`, `onSuccess`, `onError`, `onFinish`

**Not overridable per call** (setup-time only): `immediate`, `lazy`, `debounce`, `poll`, `refetchOnFocus`, `refetchOnReconnect`, `initialData`, `initialLoading`, `useGlobalAbort`.

---

## Advanced options reference

These options are available in `UseApiOptions` and flow through the factory pattern naturally. Use them situationally — do not apply them by default.

| Option | What it does | When to consider |
|--------|-------------|-----------------|
| `select` | Transforms response data before storing in `data`. Re-applied on every fetch, polling tick, and SWR revalidation. | When the component needs a different shape than what the server returns |
| `cache: true` | Auto-keys the entry from `method + url + params + data` (no manual `id`). Each page/filter/body combo gets its own entry — the correct default for paginated or filtered lists. Exposes the resolved key as `cacheKey`. Manual `id` opts out. | Server pagination/filtering where a static `id` would serve the wrong page |
| `cache: { id, swr: true }` | Returns cached data immediately, fetches fresh data silently in the background. Exposes `revalidating` ref. | When instant display matters and brief staleness is acceptable |
| `invalidateCache({ prefix })` | Busts every auto-keyed variation of an endpoint at once, e.g. `{ prefix: 'auto:GET:/products' }` after a create/update. | Invalidating all pages/filters of a list following a mutation |
| `globalOptions.cacheDefaults` (in `createApi`) | Project-wide default cache fields (`swr`, `staleTime`, `freshFor`), merged per-field under each request's own `cache`. Does NOT enable caching by itself — a request must still pass `cache`. | Setting one caching policy for the whole app instead of repeating it per composable |
| `cache: { swr: true, freshFor }` | Entries younger than `freshFor` are served with NO background revalidation — SWR stops hitting the network on every hit. Age tiers: `< freshFor` silent cache; `freshFor…staleTime` cache + silent refresh; `> staleTime` normal loading request. | Rarely-changing data (`freshFor: "1h", staleTime: "1d"` + event-driven `invalidateCache`); upgrading a plain cache to SWR without extra traffic |
| `cache` / `invalidateCache` | In-memory response cache with configurable TTL. `invalidateCache` busts related caches on mutation success. Duration fields (`staleTime`, `freshFor`) accept ms numbers or strings: `"30s"`, `"5m"`, `"1.5h"`, `"1d"` — prefer strings (typo-safe, no `24_000_000 ≠ 24h` bugs). | Repeated reads of rarely-changing data; POST/PUT/DELETE that should invalidate GET caches |
| `refetchOnFocus` | Re-fetches when the browser tab regains focus. `true` uses a 60s throttle; `{ throttle: 0 }` always refetches. | Dashboards, feeds — keep data fresh when user returns to the tab |
| `refetchOnReconnect` | Re-fetches when the browser comes back online (`online` event). No throttle. | Any data that may go stale during network outages |
| `withCredentials` | Overrides the Axios instance default for this request only. | When a specific request needs different cookie/CORS credential behavior than the global setting |
| `poll` | `poll: 5000` (ms) for simple polling, or `poll: { interval: 5000, whenHidden: false }` to control whether polling continues while the tab is hidden. | Status/progress screens, dashboards that need periodic refresh |
| `authMode: "public" \| "optional"` | `"public"` skips the Authorization header and the 401-refresh flow entirely; `"optional"` sends the token if present but doesn't force a refresh on 401. Default is `"default"` (token required, 401 triggers refresh). | Public endpoints (login, signup) or endpoints that behave differently for anonymous vs. authenticated users |
| `initialData` / `initialLoading` | Seed `data`/`loading` before the first request resolves (e.g. from SSR-adjacent hydration or a cached value). `initialLoading` defaults to `immediate`'s value. | Avoiding a loading flash when you already have data to show |
| `useGlobalAbort` | Opt this request into the global `useAbortController()` — a call to `abort()` anywhere cancels it too. Default `true`. | Set `false` for requests that must survive a global filter-change abort (e.g. a background upload) |
| `mutate` (on the return value, not an option) | Manually set `data` without making a request — `const { mutate } = fetchThing(); mutate(newValue)`. | Optimistic updates, or patching cached data after a related mutation elsewhere |

---

## Real-world scenarios

### 1. Table request
```ts
const { loading, data } = fetchSomethingTable({
  params: () => ({ ...filters.value, page: page.value, sort: sort.value }),
  immediate: true,
});
```

### 2. Download request
```ts
const { loading, execute } = downloadSomething({
  data: () => ({ ...filters.value }),
  responseType: "blob",
  onSuccess: downloadFromResponse,
});
```

### 3. Search request
```ts
const { loading, data } = searchSomething({
  params: () => ({ query: searchQuery.value }),
  debounce: 300,
  immediate: true,
});
```

### 4. Save / mutation request
```ts
const { loading, execute } = saveItem({
  data: () => form.value,
  lazy: true,           // REQUIRED: without it every form edit fires the request
  onSuccess: () => router.push("/list"),
});
```

### 5. Polling request
```ts
const { data } = fetchStatus({
  immediate: true,
  poll: 5000,
});
```

### 6. Manual request (no auto-trigger)
```ts
const { loading, execute } = fetchOnDemand({
  data: () => payload.value,
  lazy: true,           // manual control — deps must not auto-trigger
});
// called manually: execute()
```

### 7. execute() with per-call options
```ts
// feature wrapper sets composable-level defaults
const { saveItem } = useItems();
const { execute, loading } = saveItem({
  invalidateCache: 'items-count',
  onSuccess: () => refreshList(),
});

// per-call: different invalidation + toast (both onSuccess fire)
await execute({
  data: form.value,
  invalidateCache: ['items-count', 'items-list'],
  onSuccess: () => toast('Item saved!'),
});

// per-call: suppress error toast for this specific call
await execute({
  data: form.value,
  skipErrorNotification: true,
  onError: (err) => handleLocalError(err),
});
```

### 8. Batch request (useApiBatch)
```ts
// feature/<feature>/api/use<Feature>.ts
import { useApiBatch, type UseApiBatchOptions } from "@ametie/vue-muza-use";
import type { User } from "@/features/users/types";

export default () => {
  // Bulk delete by IDs
  const bulkDeleteUsers = (ids: number[], options?: UseApiBatchOptions<void>) =>
    useApiBatch(ids.map(id => ({ url: `/users/${id}`, method: 'DELETE' })), options);

  // Fetch multiple items by IDs — reactive getter auto-tracks deps
  const fetchUsersByIds = (getIds: () => number[], options?: UseApiBatchOptions<User>) =>
    useApiBatch(() => getIds().map(id => `/users/${id}`), options);

  return { bulkDeleteUsers, fetchUsersByIds };
};
```

```ts
// component
const { bulkDeleteUsers, fetchUsersByIds } = useUsers();

// Bulk delete
const { loading, execute: deleteAll } = bulkDeleteUsers(selectedIds.value, {
  onFinish: (results) => reload(),
});

// Reactive batch — re-executes when watchedIds changes
const { successfulData: users, loading: usersLoading } = fetchUsersByIds(
  () => watchedIds.value,  // auto-tracked, no lazy:true needed
);
```

`useApiBatch` also accepts `concurrency` (worker-pool limit on parallel requests),
`progress` (a `Ref` tracking `{ completed, total }` as items finish), and `settled`
(when `true`, non-2xx results land in the results array instead of throwing —
useful for "delete what we can, report the rest" bulk flows).

---

## TypeScript Gotcha — `response` vs `data`

`UseApiReturn` has two separate fields for the response:

| Field | Type | Description |
|---|---|---|
| `data` | `Ref<T \| null>` | Typed via your generic — **use this for typed access** |
| `response` | `Ref<AxiosResponse<unknown> \| null>` | Raw Axios response — intentionally `unknown`, NOT tied to generic |

`response.value?.data` is always `unknown` regardless of the generic you passed. Using `as SomeType` to silence TS here is wrong — it hides the real issue.

```ts
// ❌ Wrong — response.data is unknown, as Blob silences TS without fixing it
const { execute, response } = downloadUsers({ responseType: 'blob' })
// ...
download(response.value!.data as Blob, fileName, contentType)

// ✅ Correct — data.value is typed as Blob | null via the generic
const { execute, data } = downloadUsers({ responseType: 'blob' })
// ...
download(data.value!, fileName, contentType)
```

**Exception:** `onSuccess(response)` receives `AxiosResponse<T>` — response.data IS typed there.

```ts
// ✅ Also correct — onSuccess gets the properly typed AxiosResponse<Blob>
downloadUsers({
  responseType: 'blob',
  onSuccess: (response) => download(response.data, fileName, contentType),
})
```

---

## Security notes — token storage

`createApiClient` supports multiple auth modes (see `withCredentials`/`authOptions`
docs). Defaults store BOTH the access and refresh token in localStorage —
acceptable for internal tools, but any XSS can exfiltrate the long-lived refresh
token. For production apps prefer:

```ts
// Hybrid: Bearer access token + httpOnly refresh cookie
createApiClient({
  baseURL: "/api",
  authOptions: { refreshWithCredentials: true },
})
```

Also call `clearAllCache()` on logout — the in-memory cache is shared across the
whole app and otherwise survives across user sessions on the same page.

---

## Forbidden patterns

- Raw axios calls in components
- Repeated request logic across multiple components
- URL hidden inside the component when a feature wrapper exists
- Vague names (`requestData`, `loadStuff`)
- Unnecessary generics on every function
- Request logic without typing
- Same domain requests spread across multiple files without a wrapper

---

## Output style

- Keep it practical, typed, production-ready
- Prefer concise code over verbose abstractions
- Use domain-specific naming
- Do not add unnecessary architecture layers

---

## Example output shape

```ts
// feature/<feature>/api/use<Feature>.ts
export default () => {
  const fetchSomething = (options?: UseApiOptions<ResponseShape>) =>
    useApiPost("/domain/path", options);

  const downloadSomething = (options?: UseApiOptions<Blob>) =>
    useApiPost("/domain/export", options);

  return { fetchSomething, downloadSomething };
};
```

```ts
// component
const { fetchSomething, downloadSomething } = useFeature();

const { loading, data } = fetchSomething({
  immediate: true,
  params: () => ({ ...filters.value, page: page.value }),
});
```

---

Always prefer the feature wrapper + runtime options in component architecture.
Never flatten the API layer into components.
