# Advanced options reference

Every `UseApiOptions` field not covered in SKILL.md, plus which options can be overridden per `execute()` call.

These options are available in `UseApiOptions` and flow through the factory pattern naturally. Use them situationally —
do not apply them by default.

| Option                                        | What it does                                                                                                                                                                                                           | When to consider                                                                                                |
|-----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| `select`                                      | Transforms response data before storing in `data`. Re-applied on every fetch, polling tick, and SWR revalidation.                                                                                                       | When the component needs a different shape than what the server returns                                         |
| `cache` / `invalidateCache`                   | Opt into the app-wide policy with `cache: true` (auto-keyed from method+url+params+data).                                                                                                                               | See §Caching in SKILL.md — anything richer needs a stated, endpoint-specific reason                              |
| `refetchOnFocus`                              | Re-fetches when the browser tab regains focus. `true` uses a 60s throttle; `{ throttle: 0 }` always refetches.                                                                                                          | Dashboards, feeds — keep data fresh when user returns to the tab                                                 |
| `refetchOnReconnect`                          | Re-fetches when the browser comes back online (`online` event). No throttle.                                                                                                                                           | Any data that may go stale during network outages                                                               |
| `withCredentials`                             | Overrides the Axios instance default for this request only.                                                                                                                                                            | When a specific request needs different cookie/CORS credential behavior than the global setting                 |
| `poll`                                        | `poll: 5000` (ms) for simple polling, or `poll: { interval: 5000, whenHidden: false }` to control whether polling continues while the tab is hidden.                                                                    | Status/progress screens, dashboards that need periodic refresh                                                  |
| `authMode: "public" \| "optional"`            | `"public"` skips the Authorization header and the 401-refresh flow entirely; `"optional"` sends the token if present but doesn't force a refresh on 401. Default is `"default"` (token required, 401 triggers refresh).  | Public endpoints (login, signup) or endpoints that behave differently for anonymous vs. authenticated users      |
| `initialData` / `initialLoading`              | Seed `data`/`loading` before the first request resolves (e.g. from SSR-adjacent hydration or a cached value). `initialLoading` defaults to `immediate`'s value.                                                          | Avoiding a loading flash when you already have data to show                                                     |
| `useGlobalAbort`                              | Opt this request into the global `useAbortController()` — a call to `abort()` anywhere cancels it too. Default `true`.                                                                                                   | Set `false` for requests that must survive a global filter-change abort (e.g. a background upload)              |

---

## Per-call overrides

**Per-call overridable options:**

- Request: `data`, `params`, `headers`, `method`, `authMode`, `withCredentials`
- Caching: `cache` (replace), `invalidateCache` (replace)
- Retry: `retry`, `retryDelay`, `retryStatusCodes`
- Error: `skipErrorNotification`
- Lifecycle (merge): `onBefore`, `onSuccess`, `onError`, `onFinish`

**Not overridable per call** (setup-time only): `immediate`, `lazy`, `debounce`, `poll`, `refetchOnFocus`,
`refetchOnReconnect`, `initialData`, `initialLoading`, `useGlobalAbort`.
