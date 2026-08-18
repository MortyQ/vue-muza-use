---
name: use-api
description: Use when creating or editing an api/use*.ts wrapper, calling useApiGet/useApiPost/useApiPut/useApiPatch/useApiDelete/useApiBatch, importing @ametie/vue-muza-use, wiring a REST request in a Vue 3 app, or debugging a request that fires on every keystroke, never fires, polls forever, or errors with "Request URL is missing".
---

# Skill: Vue Muza Use API Layer

Verified against `@ametie/vue-muza-use` 1.8.2.

---

## Core pattern

This codebase uses a feature API wrapper pattern:

- Components do not call `useApiPost` / `useApiGet` directly.
- Components call a feature composable like `useProductsRequest()` or `useOrdersRequest()`.
- That composable returns typed request factories such as `fetchProducts`, `saveProduct`,
  `downloadProducts`, `deleteProduct`.
- Those factories internally call `useApi*` with an explicit URL, an explicit response
  generic, and optional request typing when needed.

```ts
// src/features/products/api/useProductsRequest.ts
import {useApiGet, useApiPost, useApiDelete, UseApiOptions} from "@ametie/vue-muza-use";
import type {Product} from "@/features/products/types";

export default () => {
    const fetchProducts = (options?: UseApiOptions<Product[]>) =>
        useApiGet<Product[]>("/products", options);

    const fetchProduct = (id: number, options?: UseApiOptions<Product>) =>
        useApiGet<Product>(`/products/${id}`, options);

    const saveProduct = (options?: UseApiOptions<Product>) =>
        useApiPost<Product>("/products", options);

    const downloadProducts = (options?: UseApiOptions<Blob>) =>
        useApiPost<Blob>("/products/export", options);

    const deleteProduct = (id: number, options?: UseApiOptions<void>) =>
        useApiDelete<void>(`/products/${id}`, options);

    return {fetchProducts, fetchProduct, saveProduct, downloadProducts, deleteProduct};
};
```

Always pass the response generic to the `useApi*` call itself. Inferring it from the
optional `options` parameter means `fetchProducts()` with no arguments — the common case —
loses the response type.

Runtime behavior belongs in the component, not in the wrapper:

```ts
// component
const {fetchProducts, downloadProducts} = useProductsRequest();

const page = ref(1);
const filters = ref({status: "active", search: ""});

const {loading, data} = fetchProducts({
    params: () => ({...filters.value, page: page.value}),
    immediate: true,
});

const {loading: downloadLoading, execute: download} = downloadProducts({
    params: () => ({...filters.value}),
    responseType: "blob",
    onSuccess: downloadFromResponse,
});
```

- Keep `useApi*` inside the feature API wrapper — never in components.
- Keep URL and response typing inside the wrapper.
- Keep runtime options in the component.
- Do not duplicate request implementation across components.

### Request kinds

| Kind               | Shape                                                                     |
|--------------------|---------------------------------------------------------------------------|
| read (GET)         | getter `params` + `immediate: true` — auto-refetches                      |
| search             | same + `debounce: 300`                                                    |
| mutation / manual  | `lazy: true`, call `execute()`                                            |
| download           | `responseType: "blob"`, read `data.value` (not `response`)                |
| upload             | `FormData` as `data` — see references/request-bodies.md                   |
| polling            | `immediate: true` + `poll` — see §Gotchas to stop it                      |
| batch              | `useApiBatch` — see references/batch.md                                   |

---

## Reactivity and triggers

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
- **Coalescing:** multiple dep changes in one flush (filter change +
  a watch resetting `page`/`sort`) send ONE request with the final values —
  reset-watches are safe by default. Opt out with `coalesce: false`.
- **Escape hatch:** `ignoreUpdates(() => { ... })` (from the composable's
  return) mutates reactive deps without triggering a request at all
  (synchronous changes only).

### There is no `enabled` option — conditional requests need `lazy` + a watcher

`useApi` has no way to declare "do not run yet", and the two intuitive workarounds
both produce a visible error instead of a skipped request:

- **A falsy URL does NOT skip the request.** `useApi.ts` throws
  `Error("Request URL is missing")`, which lands in `error.value` — and toasts,
  since `skipErrorNotification` defaults to `false`. The library's own test
  (`useApi.test.ts`) asserts exactly this for the `id.value ? url : undefined`
  pattern. The auto-trigger watcher has no falsy-URL guard.
- **A placeholder id sends a real request** (`/generations/0/prompt` → 404).

```ts
// ✅ correct — lazy + watcher, execute() only once the dep is non-null
const { data, execute } = fetchGenerationPrompt(() => toValue(id) ?? 0, { lazy: true });

watch(() => toValue(id), (value) => {
    if (value === null) return;
    void execute();
}, {immediate: true});

// ❌ wrong — sets error.value to "Request URL is missing" whenever id is null
const {data} = fetchGenerationPrompt(() => (id.value ? `/generations/${id.value}/prompt` : undefined));
```

---

## Diagnosing a broken request

| Symptom                                           | Cause                                                                                        | Fix                                                                     |
|---------------------------------------------------|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| Fires on every keystroke / form edit              | Mutation without `lazy` — auto-tracking is `lazy: false` for every method                    | `lazy: true` + manual `execute()`                                       |
| `"Request URL is missing"` in `error` / a toast   | Falsy URL used as an `enabled` flag; `useApi` throws instead of skipping                     | `lazy: true` + `watch` the dep, `execute()` once non-null               |
| Hits `/resource/0`, 404s                          | Placeholder id instead of a guard                                                            | same as above                                                           |
| Poll never stops                                  | Poll flag derived from the `data` ref (temporal dead zone)                                    | Separate `ref`, set in `onSuccess`; interval `0` clears the timer       |
| `onSuccess` never ran                             | Cache hit — library calls `mutate()` and skips `onBefore`/`onSuccess`/`onFinish`              | `computed` over `data`, or watch it                                     |
| `as Blob` / `as T` needed to compile              | Read `response.data` (always `unknown`) instead of `data`                                     | `data.value`, typed via the generic                                     |
| Upload arrives as `{"file":{...}}`, HTTP 200      | Pre-1.8, or an explicit JSON `Content-Type` on a `FormData` body                              | Upgrade to 1.8, or set the header by hand — references/request-bodies.md |
| A per-call override lost the auth/other headers   | Per-call `headers` REPLACES composable `headers` wholesale                                    | Repeat the headers still needed                                         |
| Every filter combination returns the same page    | Manual `cache: "key"` instead of auto-keying                                                  | `cache: true`                                                           |

---

## Caching

An app sets its caching policy once, app-wide, in `createApi`:

```ts
createApi({ globalOptions: { cacheDefaults: { swr: true, staleTime: "5h", freshFor: "1h" } } })
```

That is the policy for the whole app. A request opts **into** it with `cache: true` — which
also auto-keys the entry from `method + url + params + data`, so every filter/page/id
combination gets its own entry for free. `cacheDefaults` never activates caching on its own,
so `cache: true` is the only form that should appear in a `use<Domain>Request.ts` by default.

```ts
// ✅ correct — opts into the app-wide policy, auto-keyed
const fetchGenerations = (options?: UseApiOptions<PaginationWrapper<LlmGeneration[]>>) =>
  useApiGet<PaginationWrapper<LlmGeneration[]>>("/llm-usage/generations", { cache: true, ...options });
```

Anything richer — a manual `id`, a per-request `staleTime` / `freshFor` / `swr`, an
`invalidateCache` prefix — is a **local override of a global decision** and must carry a comment
saying what is different about this endpoint. Without that reason it is noise: it duplicates the
default at best, and silently diverges from it when the default changes at worst.

```ts
// ❌ wrong — restates the global policy per request, for no stated reason
useApiGet<LlmGeneration[]>("/llm-usage/generations", { cache: { swr: true, freshFor: 0, staleTime: "1h" } });

// ❌ wrong — a manual key where auto-keying is strictly better: every filter combination
//    now collides on one entry
useApiGet<LlmGeneration[]>("/llm-usage/generations", { cache: "generations" });

// ✅ acceptable — the exception is named and endpoint-specific
// Prices change on deploy, not on user action, and nothing in the app invalidates them —
// a day-long entry is deliberate here, unlike the app-wide 5h.
useApiGet<LlmPricing>("/llm-usage/pricing", { cache: { id: "llm-pricing", staleTime: "1d" } });
```

Writes are never cached. Reach for `invalidateCache` only when a mutation in the same app
changes what a cached read returns and the screen refetches it — not pre-emptively. One
call takes several prefixes, so don't chain it:
`invalidateCache({ prefix: ["auto:GET:/a", "auto:GET:/b"] })`.

Age tiers, SWR semantics and `cacheDefaults` merge rules: see references/caching.md.

---

## Gotchas

### `response` vs `data` — `response.data` is always `unknown`

| Field      | Type                                  | Description                                                       |
|------------|---------------------------------------|-------------------------------------------------------------------|
| `data`     | `Ref<T \| null>`                      | Typed via your generic — **use this for typed access**            |
| `response` | `Ref<AxiosResponse<unknown> \| null>` | Raw Axios response — intentionally `unknown`, NOT tied to generic |

Using `as SomeType` to silence TS here is wrong — it hides the real issue.

```ts
// ❌ Wrong — response.data is unknown, as Blob silences TS without fixing it
const {execute, response} = downloadUsers({responseType: 'blob'})
download(response.value!.data as Blob, fileName, contentType)

// ✅ Correct — data.value is typed as Blob | null via the generic
const {execute, data} = downloadUsers({responseType: 'blob'})
download(data.value!, fileName, contentType)
```

**Exception:** `onSuccess(response)` receives `AxiosResponse<T>` — `response.data` IS typed there.

### `onSuccess` does NOT fire on a cache hit

On a cache hit the library calls `mutate()` with the cached data and deliberately
skips `onBefore` / `onSuccess` / `onFinish` — no axios request is made. State seeded
inside `onSuccess` on a **cached** request would silently never be set.

Use `onSuccess` to derive state from responses on uncached requests (it also fires on
every polling tick and SWR revalidation). For cached requests, use a `computed` over
the `data` ref, or watch it.

### Stopping a poll

`poll` accepts a `MaybeRefOrGetter` but has no enable/disable flag — an interval of `0`
clears the internal timer. The flag driving it must be a **separate `ref`**, never the
`data` ref: the `poll` getter is passed into the same call that produces `data`, so
closing over `data` is a temporal dead zone.

```ts
const isPolling = ref(false);

const {data} = fetchResend(() => toValue(id) ?? 0, {
    poll: () => (isPolling.value ? 15_000 : 0),
    onSuccess: ({data}) => {
        isPolling.value = ACTIVE_STATUSES.has(data.status);
    },
});
```

### Per-call `headers` replaces composable `headers` wholesale

JSON is the client default; pass `FormData` as `data` and let the library derive the
content type. A per-call `headers` object does not merge key-by-key with the
composable-level one — repeat whatever else that request still needs.

Uploads, FormData and Content-Type precedence: see references/request-bodies.md — read it
before wiring any non-JSON body.

### `data` and `mutate` diverge as soon as `select` is used

`data` is typed by the first generic, `mutate` by the last — the same type until `select`
is involved, different the moment it is.

`select` / `mutate` typing, the updater form and optimistic updates: see
references/data-select-mutate.md.

---

## File structure and naming

```
src/features/<camelCaseDomain>/api/use<PascalDomain>Request.ts
```

Example:

```
src/features/products/api/useProductsRequest.ts
src/features/orders/api/useOrdersRequest.ts
src/features/productReturns/api/useProductReturnsRequest.ts
```

This file exports one composable that returns all request factories for that domain.
Types come from `@/features/<camelCaseDomain>/types`.

| Prefix        | Purpose                   |
|---------------|---------------------------|
| `fetch...`    | data reads                |
| `download...` | blob / file exports       |
| `save...`     | create actions            |
| `update...`   | mutation / update actions |
| `delete...`   | delete actions            |

Prefer descriptive domain names. Avoid vague names like `requestData`, `loadStuff`, `handleApi`.

---

## execute() per-call overrides

`execute(config?)` accepts `ExecuteConfig` — a subset of `UseApiOptions` that applies to **that call only**.
Composable-level options are unchanged for subsequent calls.

**Lifecycle callbacks merge** (both fire, composable → per-call).
**All other options replace** the composable-level value.

```ts
// feature API wrapper (composable-level — always runs)
const saveProduct = (options?: UseApiOptions<Product>) =>
    useApiPost<Product>('/products', {
        invalidateCache: 'products-count',
        onSuccess: () => refreshList(),
        ...options,
    });

// component — per-call additions
const {execute} = saveProduct();

// Both onSuccess handlers fire; only 'products-list' is invalidated on this call
await execute({
    data: {name: 'New item'},
    onSuccess: () => toast('Product created!'),
    invalidateCache: 'products-list',
});

// Silence error notification for this specific call
await execute({
    data: {name: 'Risky item'},
    skipErrorNotification: true,
});
```

Which options are overridable per call and which are setup-time only:
see references/advanced-options.md.

---

## Forbidden patterns

- Raw axios calls in components
- Repeated request logic across multiple components
- URL hidden inside the component when a feature wrapper exists
- Vague names (`requestData`, `loadStuff`)
- Second or third `UseApiOptions` generic when the request body type and `select`
  transform don't require it
- Request logic without typing
- Same domain requests spread across multiple files without a wrapper

---

## References

- `references/advanced-options.md` — full option table + per-call vs setup-time lists; read when choosing an option not covered above.
- `references/caching.md` — age tiers, SWR semantics, `cacheDefaults` merge, multi-prefix invalidation, duration format.
- `references/request-bodies.md` — uploads, FormData, Content-Type precedence, raw Blob caveat; read before any non-JSON body.
- `references/data-select-mutate.md` — `UseApiOptions` generics, `select`, `mutate` typing, optimistic updates.
- `references/batch.md` — `useApiBatch`: concurrency, progress, settled, incremental `data` + per-item `status`/`stale`, and the `useApi` options a batch accepts (`cache` incl. `swr`, `select`, `invalidateCache`, `refetchOnFocus/Reconnect`).
- `references/security.md` — token storage modes and `clearAllCache()` on logout.

---

## Version notes

Differences from 1.7.x, all behavioural rather than API-shape changes:

- Auto-triggers are coalesced by default — same-flush dep changes send one request.
- `invalidateCache` accepts several prefixes in one call.
- A `FormData` / `URLSearchParams` body derives its own Content-Type instead of inheriting
  the client's JSON default — see references/request-bodies.md for the pre-1.8 hazard.

---

Always prefer the feature wrapper + runtime options in component architecture.
Never flatten the API layer into components.
