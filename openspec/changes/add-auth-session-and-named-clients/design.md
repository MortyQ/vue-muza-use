# Design

## Context

Motivation is in `proposal.md` — Why. Requirements are in `specs/use-api-auth-session/spec.md` and
`specs/use-api-named-clients/spec.md`. This document fixes the *how* so the implementation needs
no further decisions.

Facts the design depends on (verified against `origin/main` at 1.8.3):

| Fact | Where |
|---|---|
| Refresh mutex is per `setupInterceptors()` call (closure: `isRefreshing`, `failedQueue`) | `src/features/interceptors.ts:91-92` |
| Refresh request is `axiosInstance.post(refreshUrl, payload, { authMode: "public", withCredentials })`; `withCredentials = refreshWithCredentials \|\| !tokenManager.getRefreshToken()`; tokens read from `accessToken \|\| access_token`, `refreshToken \|\| refresh_token` unless `extractTokens`; `onTokenRefreshed` is **awaited** before queued requests are released | `src/features/interceptors.ts:163-251` |
| `createApiClient` calls `tokenManager.setStorage(new LocalStorageTokenStorage({ storeRefreshToken: !refreshWithCredentials }))` unconditionally | `src/features/createInstance.ts:31` |
| `useApi` reads `{ axios, onError, globalOptions, errorParser }` from `useApiConfig()` and calls `axios.request(...)` | `src/useApi.ts:35`, `:283` |
| Setup-time options are split from axios config by destructuring; per-call config has its own strip list | `src/useApi.ts:36-62`, `:136-151` |
| `ExecuteConfig` = `Omit<UseApiOptions, "immediate" \| "initialData" \| ...>` | `src/types.ts:287` |
| Auto cache key = `` `auto:${METHOD}:${url}:${stableStringify(params)}:${stableStringify(data)}` `` | `src/features/cacheManager.ts:114` |
| `useApiBatch` runs one internal `useApi` per item and re-derives the cache key itself to read cache | `src/useApiBatch.ts:247-268`, `:303-313` |
| Global `onError(apiError, originalError)` | `src/useApi.ts:214-215` |
| Auth monitor events: `REFRESH_START`, `REQUEST_QUEUED`, `REFRESH_SUCCESS`, `REFRESH_ERROR` via `trackAuthEvent` | `src/features/monitor.ts` |
| Baseline suite: 39 files, 672 passed, 22 todo | `pnpm --filter @ametie/vue-muza-use exec vitest run` |

Consumer that drives the change: so-platform insights-client — default client → insights REST,
`tools` client → tools REST, Apollo + graphql-ws → tools GraphQL, one login issued by insights.

## Goals / Non-Goals

**Goals:**
- One refresh per expiry across any number of axios instances, Apollo, WebSocket and fetch.
- Route a `useApi` request to a named backend with correct cache isolation.
- Zero observable change for code that uses neither feature (see Backward compatibility).

**Non-Goals:**
- Changing, refactoring or re-exporting anything in `interceptors.ts` / `tokenManager.ts`.
- Making the legacy auth path use the session (2.0 candidate).
- Reactive client selection.

## Decisions

### D1 — The session is a new, parallel path; the legacy interceptor is not touched

**[SKEPTIC]** Two implementations of the 401 algorithm (legacy `setupInterceptors` and
`session.attach`) can drift; a bug fixed in one stays in the other.

**[ADVOCATE]** The overriding requirement is that existing apps see no change. Not editing
`interceptors.ts` makes that true by construction — no amount of testing gives the same
guarantee for a refactor of the most sensitive code in the library. Drift is contained by running
the *same* scenario list against both paths (task 3.3).

**Alternative rejected:** reimplement `setupInterceptors` as a thin wrapper over a hidden default
session. Cleaner, but it changes queue timing, monitor event order and `onTokenRefreshed`
awaiting in subtle ways and makes every existing auth test a regression risk.

**VERDICT:** parallel path in 1.9. `interceptors.ts` and `tokenManager.ts` get zero diff
(enforced by task 6.3). Consolidation is noted for 2.0.

### D2 — Session shape

New file `src/features/authSession.ts`, types in `src/types.ts` (types first, Rule 1):

```ts
export interface RefreshContext {
    /** Refresh token from the token store, or null (cookie-based refresh). */
    refreshToken: string | null;
    /** The access token the failed request was sent with, or the token at refresh() call time. */
    staleAccessToken: string | null;
}

export interface RefreshResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
}

export interface DeclarativeRefreshOptions {
    url: string;                       // e.g. "/auth/refresh"
    baseURL?: string;                  // e.g. "/api" or "https://insights.example"
    withCredentials?: boolean;         // same meaning as authOptions.refreshWithCredentials
    payload?: Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>);
    extractTokens?: (response: AxiosResponse) => { accessToken: string; refreshToken?: string };
    /** Awaited before waiters are released — same semantics as authOptions.onTokenRefreshed. */
    onTokenRefreshed?: (response: AxiosResponse) => void | Promise<void>;
    timeout?: number;                  // default 60000, same as createApiClient
}

export interface AuthSessionOptions {
    refresh: DeclarativeRefreshOptions | ((ctx: RefreshContext) => Promise<RefreshResult>);
    /** Token store. Default: the exported tokenManager singleton. */
    tokens?: TokenManager;             // type-only export of the existing class type
    /**
     * When set, the session configures its token store once at creation
     * (explicit replacement for the legacy implicit setStorage side effect).
     * Undefined: storage is left exactly as it is.
     */
    storeRefreshToken?: boolean;
    /**
     * Default false; lockName default "vue-muza-use:auth-refresh".
     * Token adoption needs a token store shared between tabs (default tokenManager / localStorage).
     * With a per-tab store, refreshes are only serialised — every tab still refreshes on its own.
     */
    crossTab?: boolean | { lockName?: string };
    fetch?: typeof fetch;              // default: globalThis.fetch, resolved at call time
}

export interface AuthSessionEventMap {
    refreshStart: { staleAccessToken: string | null };
    refreshed: { accessToken: string; response: AxiosResponse | null };
    refreshFailed: { error: unknown };
    cleared: Record<string, never>;
}
export type AuthSessionEvent = keyof AuthSessionEventMap;

export interface AuthSession {
    getAccessToken(): string | null;
    getAuthHeader(): string | null;
    refresh(options?: { staleAccessToken?: string | null }): Promise<string>;
    readonly isRefreshing: boolean;
    on<E extends AuthSessionEvent>(event: E, listener: (payload: AuthSessionEventMap[E]) => void): () => void;
    clear(): void;
    fetch: typeof fetch;
    /** @internal used by createApiClient({ auth }); exported on the object, documented as advanced. */
    attach(instance: AxiosInstance): void;
}
```

`TokenManager` type: `tokenManager.ts` already exports the class; `src/types.ts` imports it as
`import type`. No edit to `tokenManager.ts`.

Events: listeners are stored per event in a `Set`; emit iterates a copy; each listener is called
in `try/catch`, errors go to `console.error("[vue-muza-use] auth session listener failed", err)`
and never reach the refresh promise. Events are synchronous and fire **after** the token store has
been updated (`refreshed`) or cleared (`refreshFailed`, `cleared`).

**Why events plus an awaited `onTokenRefreshed`:** events cover fan-out side effects (WS
reconnect, Apollo `clearStore`, Sentry, logout). The legacy awaited hook is kept on the
declarative form because some apps load permissions from the refresh response and must do it
before the queued requests are retried.

### D3 — Single-flight refresh algorithm

```
refresh({ staleAccessToken = tokens.getAccessToken() } = {}):
    if inflight: return inflight
    inflight = run(staleAccessToken).finally(() => inflight = null)
    return inflight

run(stale):
    emit("refreshStart", { staleAccessToken: stale }); trackAuthEvent(REFRESH_START)
    withLock(async () => {
        if crossTab:
            current = tokens.getAccessToken()
            if current && current !== stale: return { accessToken: current, adopted: true }
        result = await transport({ refreshToken: tokens.getRefreshToken(), staleAccessToken: stale })
        if !result.accessToken: throw Error("No access token in refresh response")
        tokens.setTokens(result)
        if declarative && onTokenRefreshed: await onTokenRefreshed(response)
        return result
    })
    success → trackAuthEvent(REFRESH_SUCCESS); emit("refreshed", ...); resolve accessToken
    failure → tokens.clearTokens(); trackAuthEvent(REFRESH_ERROR, { error }); emit("refreshFailed", { error }); rethrow
```

- `withLock` = `navigator.locks.request(lockName, fn)` when `crossTab` is on **and**
  `typeof navigator !== "undefined" && navigator.locks`; otherwise `fn()` directly. Only one
  in-tab caller ever reaches the lock (single-flight sits above it).
- Adoption (`current !== stale`) works only because the default store is `localStorage`, which
  every tab reads. The session cannot detect whether a custom `TokenStorage` is shared, so it does
  not warn at runtime; the limitation is stated in the `crossTab` JSDoc and the README instead.
  With a per-tab store the lock serialises refreshes but every tab refreshes on its own — with a
  one-time-use refresh token the second tab's refresh fails and ends its session.
- Declarative transport: a **private** `axios.create({ baseURL, timeout, headers: { "Content-Type": "application/json" } })`
  with no interceptors, created once per session. POST `url`, payload resolved like the legacy
  code, `withCredentials: withCredentials || !tokens.getRefreshToken()` — identical expression to
  `interceptors.ts:181`. Token extraction identical to `interceptors.ts:223-231`. Because the
  transport instance has no interceptors, a 401 from the refresh endpoint cannot recurse.
- Function transport: called as-is. **Contract (documented in JSDoc):** if it sends its request
  through an attached instance, it must pass `authMode: "public"`; otherwise a 401 from the
  refresh endpoint would wait on the refresh that is sending it.
- Devtools: the declarative transport reports the refresh request through the same
  `devtoolsBridge.onRequestStart/onRequestEnd` calls and `redactTokenFields` the legacy code uses
  (`interceptors.ts:183-218`, `:254-270`), so the panel looks the same.
- `clear()` → `tokens.clearTokens()`, `emit("cleared")`. It does not abort an in-flight refresh.

### D4 — `attach(instance)` = the legacy 401 contract, routed to the session

Request interceptor: `authMode === "public"` → leave config untouched; otherwise set
`Authorization` from `session.getAuthHeader()` or delete it — same as `interceptors.ts:111-126`.

Response interceptor (same guards, same order as `interceptors.ts:133-147`):
1. not a 401, no config, or `_retry` already set → reject.
2. `authMode` `public` / `optional` → reject.
3. Mark `_retry = true`. If a refresh is already in flight, `trackAuthEvent(REQUEST_QUEUED, { url })`.
4. `const token = await session.refresh({ staleAccessToken: <token from the failed request's Authorization header, or null> })`.
5. Set the new `Authorization`, `flagAuthRetry`-equivalent devtools marking, `return instance(originalRequest)`.
6. Refresh rejected → reject with the refresh error (tokens already cleared, event already emitted).

`flagAuthRetry` and `isRefreshRequest` are module-private in `interceptors.ts`. Copy the ~10 lines
of `flagAuthRetry` into `authSession.ts` rather than exporting them (no diff to `interceptors.ts`).

`createApiClient` (`src/features/createInstance.ts`):

```ts
export interface CreateApiClientOptions extends CreateAxiosDefaults {
    withAuth?: boolean;
    authOptions?: InterceptorOptions;
    /** New in 1.9. When set, withAuth/authOptions are ignored and no global storage is configured. */
    auth?: AuthSession;
}
```

`if (auth)` branch at the top: create the axios instance with the same defaults, `auth.attach(instance)`,
warn in development if `authOptions` or `withAuth === false` was also passed, return. The `else`
branch is the current function body, unchanged line for line. The `auth` key must be removed from
the object spread into `axios.create`.

### D5 — `session.fetch`

```
fetch(input, init):
    if caller set an Authorization header (init.headers or a Request's headers): passthrough, no refresh
    token = getAccessToken(); send with Authorization if token
    response = await impl(...)
    if response.status !== 401 || no token was sent: return response
    replayable = body is undefined | null | string | URLSearchParams | FormData | Blob | ArrayBuffer | ArrayBufferView,
                 or input was a Request we cloned before the first send
    try { newToken = await refresh({ staleAccessToken: token }) } catch { return response }
    if !replayable: return response
    return impl(... with Authorization: Bearer newToken)
```

`impl` = `options.fetch ?? globalThis.fetch`, read at call time so tests can stub it. `fetch` is a
bound arrow property so `new HttpLink({ fetch: session.fetch })` works without `.bind`.

### D6 — Named clients

**[SKEPTIC]** Absolute URLs (`${TOOLS_URL}/brands`) already work today with zero library change;
named clients add API surface and a second cache-key format.

**[ADVOCATE]** Absolute URLs leak the backend into every wrapper, need a `new URL()` trick for
the dev proxy, cannot carry a per-backend `errorParser`, timeout or headers, and give no
compile-time check. Per-request `baseURL` is worse: the cache key ignores `baseURL`, so two
backends silently share entries.

**VERDICT:** named clients.

New file `src/features/clientRegistry.ts`:

```ts
export const DEFAULT_CLIENT = "default";

export interface ResolvedClient { name: string; axios: AxiosInstance; errorParser?: (e: unknown) => ApiError }

/** Validates config.clients once (reserved name), memoised per ApiPluginOptions object (WeakMap). */
export function resolveClient(config: ApiPluginOptions, name: string | undefined): ResolvedClient
```

- `name` undefined or `"default"` → `{ name: "default", axios: config.axios, errorParser: config.errorParser }`.
- Registered name → its axios; `errorParser` = client's ?? global.
- Unknown → `throw new Error(\`[vue-muza-use] Unknown API client "${name}". Registered: default, ${list}\`)`.
- Reserved check (`clients.default`) happens in `createApi` so misconfiguration fails at startup.

Types (`src/types.ts`):

```ts
/** Augment to type-check client names: declare module "@ametie/vue-muza-use" { interface ApiClientRegistry { tools: true } } */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ApiClientRegistry {}
export type ApiClientName = [keyof ApiClientRegistry] extends [never]
    ? string
    : "default" | Extract<keyof ApiClientRegistry, string>;
export interface ApiClientConfig { axios: AxiosInstance; errorParser?: (error: unknown) => ApiError }
export interface ApiErrorContext { client: string }

// ApiPluginOptions — additive:
clients?: Record<string, AxiosInstance | ApiClientConfig>;
onError?: (error: ApiError, originalError: unknown, context: ApiErrorContext) => void;
// UseApiOptions — additive:
client?: ApiClientName;
// UseApiBatchOptions and BatchRequestConfig — additive:
client?: ApiClientName;
```

Distinguish `AxiosInstance` from `ApiClientConfig` by `"axios" in value && typeof value.request !== "function"`
— an axios instance is itself a function with `.request`.

`ExecuteConfig` gains `| "client"` in its `Omit` list (client is fixed per composable). The
per-call strip list in `useApi.ts:136-151` also drops `client: _cfgClient` defensively so an
untyped caller cannot leak it to axios.

`useApi.ts` changes (the whole list — nothing else in the file moves):
1. destructure `client: clientName` with the other useApi-only options (`:36-62`);
2. `const resolved = resolveClient(config, clientName)` right after `useApiConfig()` — throws
   synchronously on an unknown name;
3. `toApiError` uses `resolved.errorParser ?? parseApiError`;
4. `axios.request` → `resolved.axios.request`;
5. `globalErrorHandler(apiError, err, { client: resolved.name })`;
6. `resolveCacheKey(..., resolved.name)`.

`cacheManager.ts`: `resolveCacheKey` gets an optional 6th parameter `client?: string`. Undefined or
`"default"` → today's string, byte-identical. Otherwise
`` `auto@${client}:${METHOD}:${url}:${params}:${data}` ``. Manual `id` is returned before either
branch, unchanged.

`useApiBatch.ts`: `const itemClient = config.client ?? apiOptions.client`; pass `client: itemClient`
into the internal `useApi` options and into `readBatchCache`'s `resolveCacheKey` call. `client`
must not be spread into axios config by the batch either.

### D7 — Public exports (`src/index.ts`, barrel only)

```ts
export { createAuthSession } from "./features/authSession";
// types via existing `export * from "./types"` — AuthSession, AuthSessionOptions, AuthSessionEvent,
// AuthSessionEventMap, RefreshContext, RefreshResult, DeclarativeRefreshOptions,
// ApiClientRegistry, ApiClientName, ApiClientConfig, ApiErrorContext
```

`clientRegistry.ts` stays internal (Rule 4).

## Backward compatibility

Every item below must be identical to 1.8.3; the "proof" column is what the tasks run.

| Behaviour | Proof |
|---|---|
| All existing tests, unedited | full suite: 39 files / 672 passed / 22 todo before; same files still pass after (task 1.1 baseline, every group's final step) |
| Legacy 401 path | `git diff --exit-code origin/main -- packages/use-api/src/features/interceptors.ts packages/use-api/src/features/tokenManager.ts` (task 6.3) |
| `createApiClient` without `auth` | existing `tests/features/createInstance.test.ts` + new "no auth → unchanged" test |
| Default cache keys | existing `tests/useApi.autoCache.test.ts` asserts the literal `auto:GET:/users:{"page":1}:` |
| `onError` callers with two params | additive third param; existing global-error-handler tests |
| Public type surface | `.d.ts` diff of `dist/index.d.ts` built from `origin/main` vs branch contains only additions (task 6.2) |
| Bundle | no new dependency; `navigator.locks` touched only behind `crossTab` |

## Risks / Trade-offs

- [Two 401 implementations drift] → shared scenario table run against both (task 3.3); 2.0 merges them.
- [Function transport sends refresh through an attached instance without `authMode: "public"` → self-wait] → JSDoc contract + README warning + a test that the documented pattern works.
- [`refresh()` called by Apollo after another tab already refreshed sends one extra refresh] → harmless with cookie rotation (cookie is shared); pass `staleAccessToken` for exact adoption; documented in the Apollo recipe.
- [Web Locks missing in jsdom/happy-dom] → feature-detected fallback; tests stub `navigator.locks`.
- [`crossTab` with a per-tab token store (in-memory / custom `TokenStorage`) cannot adopt another tab's token → each tab refreshes; with a one-time-use refresh token the later tab is logged out] → not detectable at runtime; documented on `crossTab` and in the README, pinned by the "Per-tab token store does not adopt" scenario.
- [`ApiClientName` collapses to `string` without augmentation] → intended; typo protection is opt-in.
- [`throw` on unknown client in setup crashes the component] → it is a static misconfiguration; failing loudly at first render is preferred over a silent wrong-backend request.
- [`session.fetch` passthrough when caller sets Authorization] → avoids clobbering deliberate headers; documented.

## Migration Plan

Release as 1.9.0 via a `feat(auth): ...` / `feat(clients): ...` commit series (semantic-release →
minor). Consumers opt in per app; nothing changes until they do. Rollback = pin `1.8.x`. so-platform
adopts it in a separate change after publish.
