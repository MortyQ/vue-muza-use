# Proposal

[minor] Add `createAuthSession` (one shared token-refresh owner) and named API clients
(`createApi({ clients })` + `client` option). Purely additive — every existing call site, cache
key, token-storage mode and interceptor behaviour stays byte-for-byte identical. Target: 1.9.0.

## Why

Auth is welded to a single axios instance, and `useApi` can talk to exactly one instance. A
consumer that needs a second backend (so-platform is folding tools-client into insights-client:
REST to `insights.api`, REST + GraphQL + WebSocket to `tools.api`, one login) hits all of this at
once:

- The 401 refresh mutex (`isRefreshing` + `failedQueue`) is a closure inside each
  `setupInterceptors()` call (`src/features/interceptors.ts:91-92`). Two instances → two
  independent refreshes. With a one-time-use refresh token the second one fails and logs the user
  out.
- The refresh request is sent through the instance's own `baseURL`
  (`src/features/interceptors.ts:200`), so a second instance cannot delegate refresh to the
  first backend.
- `createApiClient()` calls `tokenManager.setStorage(...)` globally
  (`src/features/createInstance.ts:31`): a second client silently overwrites the first one's
  storage mode.
- `createApi` accepts one `axios` (`src/plugin.ts`, `src/useApi.ts:35`), and the auto cache key
  (`src/features/cacheManager.ts:114`) carries no notion of which backend answered — `GET /brands`
  from two backends would share one entry.
- Code outside axios (Apollo links, `graphql-ws` `connectionParams`, `fetch`-based SSE) has no way
  to reuse the refresh. Every consumer re-implements it: pim-client already runs two refresh
  implementations with two mutexes, and insights-client's SSE logs the user out on a 401 that a
  refresh would have fixed.

## What Changes

- **New `createAuthSession(options)`** — a standalone auth session that owns token access, a
  single-flight `refresh()`, lifecycle events (`on("refreshed" | "refreshFailed" | "cleared" |
  "refreshStart")`), `clear()`, an auth-aware `fetch`, and `attach(axiosInstance)` to install the
  same 401 → refresh → retry behaviour on any number of axios instances that then share one
  mutex.
  - Refresh is pluggable: either a declarative `{ url, baseURL, withCredentials, payload,
    extractTokens }` object (mirrors today's `authOptions`), or a function — so a GraphQL refresh
    mutation, or a refresh against a different backend, is a few lines.
  - Optional `crossTab: true` — tabs coordinate through the Web Locks API, so two tabs refreshing
    at once perform one refresh and the other tab adopts the new token instead of failing.
    Adoption requires a token store shared between tabs (the default `localStorage`-backed
    `tokenManager`); with a per-tab store refreshes are only serialised. Documented, not detected.
- **`createApiClient({ authSession: session })`** — new option. When present, the instance is wired to
  the session instead of getting its own interceptor pair, and the global
  `tokenManager.setStorage()` side effect is skipped. Without `authSession`, `createApiClient` runs the
  exact code path it runs today.
- **Named clients** — `createApi({ axios, clients: { tools: toolsAxios } })` registers extra axios
  instances (optionally with their own `errorParser`). `useApi`, the method helpers and
  `useApiBatch` (batch-level and per item) accept `client: "tools"`.
  - Named-client cache keys are namespaced (`auto@tools:GET:/brands:...`); the default client's
    keys are unchanged (`auto:GET:/brands:...`).
  - Client names are type-checked through an augmentable `ApiClientRegistry` interface; without
    augmentation any string is accepted.
  - Unknown client name → a descriptive error at `useApi` call time.
- Global `onError` receives an optional third argument `{ client }` for named-client failures.
  Default-client failures keep calling it with exactly the two arguments of 1.8.x.
- README and the in-repo `use-api` skill gain sections for both features, including recipes for
  Apollo (`errorLink` → `session.refresh()`, `HttpLink({ fetch: session.fetch })`) and
  `graphql-ws` (`session.on("refreshed", ...)` → reconnect). The library takes **no** dependency
  on Apollo or graphql-ws.

No **BREAKING** changes. No existing export is renamed, removed or re-typed.

Public exports added: `createAuthSession`, types `AuthSession`, `AuthSessionOptions`,
`AuthSessionEvent`, `AuthSessionEventMap`, `RefreshContext`, `RefreshResult`,
`DeclarativeRefreshOptions`, `ApiClientRegistry`, `ApiClientName`, `ApiClientConfig`,
`ApiErrorContext`. Changed (additive fields only): `CreateApiClientOptions.authSession`,
`ApiPluginOptions.clients`, `ApiPluginOptions.onError` (optional third arg), `UseApiOptions.client`,
`UseApiBatchOptions.client`, `BatchRequestConfig.client`.

## Capabilities

### New Capabilities
- `use-api-auth-session`: a shared authentication session — token access, single-flight refresh
  shared by every attached axios instance and by non-axios consumers, lifecycle events,
  cross-tab coordination, auth-aware fetch.
- `use-api-named-clients`: routing `useApi` / `useApiBatch` requests to one of several registered
  axios instances by name, with per-client error parsing and client-scoped cache keys.

### Modified Capabilities
- None — `openspec/specs/` is empty; existing behaviour is pinned by the compatibility
  requirements in both new capabilities and by the unchanged existing test suite.

## Impact

- **Package:** `packages/use-api` only. `packages/devtools` is untouched (showing the client name
  in the panel is a follow-up). `packages/playground` may gain a demo page; it is not published.
- **Code:** new `src/features/authSession.ts`, new `src/features/clientRegistry.ts`; additive
  edits to `src/types.ts`, `src/features/createInstance.ts`, `src/features/cacheManager.ts`,
  `src/plugin.ts`, `src/useApi.ts`, `src/useApiBatch.ts`, `src/index.ts`. `src/features/interceptors.ts`
  and `src/features/tokenManager.ts` are **not edited**.
- **Dependencies:** none added. Web Locks is used only when `crossTab` is on and
  `navigator.locks` exists.
- **Backend contract:** no backend change. The session works with whatever the app's refresh
  endpoint returns, exactly as `authOptions` does today.

## Out of Scope

- Rebuilding the legacy `createApiClient({ withAuth, authOptions })` path on top of the session.
  It stays as-is in 1.x; folding it in is a 2.0 candidate.
- Removing the deprecated `tokenManager.setRefreshPromise/getRefreshPromise/clearRefreshPromise`.
- Proactive refresh before token expiry.
- Shipping an Apollo link or a graphql-ws helper as code (recipes in docs only).
- Devtools UI for client names or session events.
- Reactive (`MaybeRefOrGetter`) client selection and per-`execute()` client override.
- Any consumer-app change (so-platform migrates in its own change after 1.9.0 is published).
