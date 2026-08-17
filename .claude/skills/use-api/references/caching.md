# Caching details

Age tiers, SWR semantics, `cacheDefaults` merge rules, multi-prefix invalidation and duration formats. The policy
itself — `cache: true` and nothing else without a stated reason — is in SKILL.md §Caching.

## Auto-keyed entries

`cache: true` auto-keys the entry from `method + url + params + data` (no manual `id`). Each page/filter/body combo
gets its own entry — the correct default for paginated or filtered lists. Exposes the resolved key as `cacheKey`.
A manual `id` opts out of auto-keying.

Use it for server pagination/filtering where a static `id` would serve the wrong page.

## SWR

`cache: { id, swr: true }` returns cached data immediately and fetches fresh data silently in the background.
Exposes a `revalidating` ref. Use when instant display matters and brief staleness is acceptable.

`onSuccess` still fires on every SWR revalidation, but NOT on the initial cache hit — see SKILL.md §Gotchas.

## Age tiers with `freshFor`

`cache: { swr: true, freshFor }` — entries younger than `freshFor` are served with NO background revalidation, so SWR
stops hitting the network on every hit. Age tiers:

- `< freshFor` — silent cache hit
- `freshFor…staleTime` — cache hit + silent refresh
- `> staleTime` — normal loading request

Use for rarely-changing data (`freshFor: "1h", staleTime: "1d"` + event-driven `invalidateCache`), or to upgrade a
plain cache to SWR without extra traffic.

## `globalOptions.cacheDefaults` (in `createApi`)

Project-wide default cache fields (`swr`, `staleTime`, `freshFor`), merged per-field under each request's own `cache`.
Does NOT enable caching by itself — a request must still pass `cache`. Use it to set one caching policy for the whole
app instead of repeating it per composable.

Precedence, per field: `cacheDefaults` < composable `cache` < per-call `execute({ cache })`.
`cacheDefaults.id` is ignored — the key comes from the composable/per-call `id`, or is auto-derived.

## Invalidation

In-memory response cache with configurable TTL. `invalidateCache` busts related caches on mutation success — only
after a confirmed 2xx, never in catch/finally.

```ts
invalidateCache('products-count');                              // exact key
invalidateCache(['products-count', 'products-list']);           // several exact keys
invalidateCache({ prefix: 'auto:GET:/products' });              // every auto-keyed page/filter of one endpoint
invalidateCache({ prefix: ['auto:GET:/products', 'auto:GET:/categories'] });   // several endpoints, one pass
```

Empty prefixes are ignored, so `{ prefix: '' }` and `{ prefix: [] }` can never wipe the whole cache by accident.

## Duration format

Duration fields (`staleTime`, `freshFor`) accept ms numbers or strings: `"30s"`, `"5m"`, `"1.5h"`, `"1d"`.
Prefer strings — typo-safe, and no `24_000_000 ≠ 24h` bugs.

## Logout

Call `clearAllCache()` on logout — the cache is module-level and shared across the whole app, so it otherwise survives
across user sessions on the same page.
