# Deep Analysis — @ametie/vue-muza-use (packages/use-api)

> **Purpose of this file:** shared context for future agents and the maintainer.
> Snapshot of a full source review: strengths, weaknesses, confirmed defects,
> security notes, skill/doc drift, and a prioritized improvement backlog.
>
> **Date:** 2026-07-06 · **Version analyzed:** 1.5.4 · **Test suite:** 467 passed / 22 todo (26 files, green)
> **Scope:** every file in `packages/use-api/src/` + `.claude/skills/use-api/SKILL.md` + README cross-checks.
> **Implementation plan:** `.agents/plans/2026-07-06-bugfix-and-hardening-plan.md` — task-by-task TDD plan for every item below.

---

## 1. Snapshot

| Area | State |
|---|---|
| Source size | ~2,800 LOC source, ~5,600 LOC tests |
| Layers | Match `library-architecture.instructions.md` map (plus `devtools.ts` + `utils/urlUtils.ts`, not yet in the map) |
| Tests | `pnpm --filter @ametie/vue-muza-use exec vitest run` → all green. Note: `pnpm --filter ... test --run` from workflow.md does NOT work (pnpm eats `--run`); use `exec vitest run` or `test -- --run` |
| Public surface | `index.ts` barrel + `export * from "./types"` (see §4.14) |

---

## 2. Strengths (what is genuinely good — keep it)

1. **Auto-tracking via `effectScope`** (`useApi.ts:437-475`) — url/params/data getters tracked in a private scope; `flush: 'pre'` batches synchronous dep changes into one request (tested). `ignoreUpdates()` pause/resume/stop/restart trick is clever and correct.
2. **`ExecuteConfig` as a subtractive type** (`types.ts:207`) — `Omit<UseApiOptions, setup-time-keys>` means every future option is per-call-overridable by default. Good design; one leak, see §4.3/§4.4.
3. **Race-condition discipline**: previous request aborted on new execute; `cancellableSleep` for retry delays; abort-during-retry-sleep resets loading; 401 refresh queue is scoped per `setupInterceptors()` call (explicit comment about cross-instance contamination — someone learned this the hard way).
4. **SWR implementation is correct**: cache stores *raw* server data, `select` re-applied on every read; `revalidating` ref separate from `loading`; cache write/invalidate only on 2xx.
5. **`useApiBatch` cleanup**: each internal `useApi` runs in its own `effectScope` that is stopped in `finally` — poll timers/listeners can't leak from batch items. Worker-pool concurrency limiter is simple and correct.
6. **Test culture**: 467 tests, including cleanup-on-unmount, debounce races, retry+abort interplay, SWR, executeConfig merge semantics. This is far above typical library hygiene.
7. **Error model**: single `ApiError` shape, pluggable `errorParser`, global `onError` with `skipErrorNotification` opt-out at composable AND per-call level.
8. **JSDoc coverage** on public surface is strong (gaps listed in §4.8).

## 3. Architectural trade-offs (conscious cons — document, don't necessarily "fix")

| Decision | Pro | Con |
|---|---|---|
| Module-level singletons (`tokenManager`, `cacheStore`, `globalConfig`, global abort) | Zero-config, works in Pinia/plain code | Two `createApiClient()` instances share one tokenManager (last `setStorage` wins → token contamination across differently-configured clients); microfrontends / multiple Vue apps clash; test isolation requires manual resets |
| `useApiConfig()` prefers `globalConfig` over injection (`plugin.ts:26`) | Works outside components | `app.provide` is effectively dead code once any `createApi()` was called; two apps on one page get the same config. `globalConfig` is set at `createApi()` *call* time, not install time |
| Auto-tracking default `lazy: false` for ALL methods | Great DX for GET | **Footgun for mutations**: `useApiPost` with `data: () => form.value` fires a POST on every form keystroke unless `lazy: true`. README documents the opt-out; the skill does not (§5) |
| Manual cache keys (`cache: { id }`) | Predictable, explicit | Same id + different params silently serves wrong data; no in-flight deduplication of identical concurrent requests |
| `deep: true` watches (autotrack + devtools state) | Catches nested changes | CPU cost proportional to payload size on every change; devtools watch runs **even when devtools is disabled** (§4.1) |
| SPA-only (no SSR) | Simplicity | Intentional — see memory `project_spa_decision.md`. `typeof document/window` guards already exist; do NOT propose Nuxt/SSR work |

---

## 4. Defects & code smells (verified in source)

Ordered roughly by severity. Line refs are for v1.5.4.

1. **[bug, memory leak] Devtools `pendingCalls` grows unbounded when devtools is disabled.** `devtools.ts:52-58`: `onInstanceCreated` pushes a closure into `pendingCalls` whenever `bridge === null`. `initDevtools` (the only thing that flushes the queue) is called only when `options.devtools` is set. In a production app without devtools, **every `useApi()` call permanently retains a closure** (id, url, options). Amplified by `useApiBatch`, which creates a `useApi` per item per execution. Related: (a) the devtools state `watch(..., { deep: true })` in `useApi.ts:102-113` runs for every instance regardless of devtools being enabled — deep-traverses response data on every change; (b) if the bridge loads late, queued `onInstanceCreated` replays instances that were already destroyed (`onInstanceDestroyed` is a plain no-op while bridge is null). **Fix (patch):** only queue when devtools was configured; remove queued entries on destroy; skip the state watch entirely when devtools is off.
2. **[leak] Unconditional `visibilitychange` listener per instance.** `useApi.ts:490-505` registers a document listener for poll catch-up even when `poll` is not configured — one listener per `useApi` instance. Combined with: when called **outside any scope** (plain module code), neither this listener nor `trackingScope` is ever cleaned up (`onScopeDispose` is guarded by `getCurrentScope()`, with no fallback). `useApiBatch` protects itself with its own `effectScope`; direct out-of-scope usage leaks. **Fix (patch):** register the listener only when `getPollConfig().interval > 0` possible (or lazily on first poll), and document the out-of-scope contract.
3. **[bug] Per-call `...config` is spread raw into `axios.request()`.** `useApi.ts:266-275`: setup-time options are carefully destructured so useApi-only keys never reach axios, but the per-call path forwards the whole `ExecuteConfig` — `cache`, `invalidateCache`, `retry*`, `skipErrorNotification`, `select`, `onSuccess/onError/onBefore/onFinish` all land in the axios config (→ visible in `response.config`, interceptors, devtools records). **Fix (patch):** destructure `config` the same way as `options` before spreading.
4. **[type bug] `ExecuteConfig` advertises `select` but `executeRequest` ignores `config.select`** — `applySelect` closes over the composable-level `select` only. Either honor it (minor) or add `select` to the `Omit` list (patch, arguably a type-level fix).
5. **[bug] `useAbortController().signal` is stale.** `useAbortController.ts:24` snapshots `abortController.signal` into a ref at call time; after `abort()` swaps in a new controller, the ref still points at the old (aborted) signal. Any consumer using `signal` (as the JSDoc example suggests!) gets a permanently-aborted signal after the first global abort. `getSignal()` is the only correct API. Also `isAbortError` checks `DOMException "AbortError"`, but axios cancellation produces `CanceledError`/`ERR_CANCELED` — it is ~never true in this stack. **Fix (patch):** recompute signal from `abortCount` (e.g. `computed(() => { abortCount.value; return abortController.signal; })`) and extend `isAbortError`.
6. **[dead code / subtle] `const startLoading = initialLoading ?? immediate` (`useApi.ts:88`)** — `initialLoading` is destructured with default `false`, so `?? immediate` can never fire. Consequence: with `immediate: true` + `debounce > 0`, `loading` stays `false` during the initial debounce window (execute is deferred, so the synchronous `setLoading(true)` hasn't happened). Intent was clearly "default initialLoading to immediate". **Fix (patch):** destructure without default and compute `initialLoading ?? immediate`.
7. **[security-adjacent] Refresh endpoint detection by substring.** `interceptors.ts:114`: `originalRequest.url?.includes(refreshUrl)` — `/auth/refresh-devices` is misclassified as the refresh call (skips queueing, clears tokens, fires `onTokenRefreshFailed` on its 401). **Fix (patch):** compare parsed pathname / `endsWith` / exact match.
8. **[docs bug] Dangling JSDoc in `types.ts:160-165`** — the polling doc-block sits orphaned above `cache`; the `poll` property (`types.ts:182`) shows no docs in IDEs. Also duplicated declarations: `AuthTokens` in both `types.ts` and `tokenManager.ts`; `TOKEN_TYPE` in both `tokenManager.ts` and `interceptors.ts` — drift risk.
9. **[dead code] `TokenManager.setRefreshPromise/getRefreshPromise/clearRefreshPromise`** — never used by interceptors (the refresh mutex is `isRefreshing` + `failedQueue` inside `setupInterceptors`). Remove or wire up.
10. **[type flaw] `ApiRequestConfig.params?: MaybeRefOrGetter<D> | D`** — params share the body generic `D`. A typed POST body forces params into the same shape. Should be an independent generic or `Record<string, unknown>`-ish.
11. **[type nit] `UseApiReturn.execute` returns `Promise<T | null | undefined>`** — the implementation can only produce `T | null` (debounce-cancel is caught → `null`). Drop `undefined`.
12. **[robustness] `localStorage` accessed without try/catch** (`tokenManager.ts`) — Safari private mode / storage-blocked iframes throw, which would crash the request interceptor. Wrap and degrade to in-memory.
13. **[api hygiene] `index.ts` uses `export * from "./types"`** plus a redundant `export type { ApiError }` — the entire types file (including devtools-internal types like `DevtoolsBridge`, `RequestEndResult`) is silently public API, so any rename there is technically a major bump. Architecture rule says the barrel is the *only* surface — make it explicit.
14. **[conventions drift]** (a) tests live in three places (`src/*.test.ts`, `src/composables/*.test.ts`, `src/__tests__/`) while `testing.instructions.md` says all tests live in `__tests__/`; (b) style islands: `useApi.ts:437-475` and `useRefetchTriggers.ts` are semicolon-less/single-quote, `useApiState.ts` is 2-space — conventions.md says 4-space/double/semicolons; (c) architecture map is missing `devtools.ts`, `utils/urlUtils.ts`, and the actual test layout.
15. **[minor] Batch non-settled mode throws a plain `ApiError` object literal** (not an `Error` instance) — consumer `catch` blocks get no stack; `error.value = err as ApiError` cast in `useApiBatch.ts:336`.
16. **[UX gap, confirmed 2026-07-06] Token-refresh requests are invisible in devtools.** Instrumentation lives only in `useApi.executeRequest`; the refresh POST fires inside the axios response interceptor (`interceptors.ts`, `axiosInstance.post(refreshUrl, ...)`) and bypasses it. Users see the original 401'd request stuck "pending" for the whole refresh+replay with no explanation. The panel already supports standalone records (`instanceId: null` documented in `packages/devtools/src/shared/types/index.ts:58`) — fix is use-api-side only, MUST redact token fields in the recorded payload/response. → Plan Task 2b. Related drift: `project.md` repo map omits `packages/devtools` entirely.

---

## 5. Security review

1. **Refresh token in `localStorage` by default.** `LocalStorageTokenStorage` defaults `storeRefreshToken: true`; `createApiClient` only flips it off when `authOptions.refreshWithCredentials: true`. Any XSS = full session exfiltration incl. long-lived refresh token. The hybrid mode (httpOnly refresh cookie) exists and is good — but it's opt-in. **Recommendation:** keep default for backward-compat but add a loud README/skill security section + consider flipping the default in v2. The "smart detection" in `interceptors.ts:150` (no stored refresh token → auto `withCredentials`) is a nice mitigation already.
2. **Token keys are unnamespaced** (`accessToken`, `refreshToken`, `tokenExpiresAt`) — collide across apps on the same origin (staging environments, micro-frontends). **[minor]** configurable prefix, default `muza:`.
3. **Shared in-memory cache across users.** Cache survives logout unless the app calls `clearAllCache()` manually (only documented in a comment). **[minor]** opt-in auto-wipe: call `clearAllCache()` from `tokenManager.clearTokens()` or on `onTokenRefreshFailed`.
4. **No cross-tab refresh coordination** — two tabs hitting 401 simultaneously both fire `/auth/refresh`; with rotating refresh tokens the loser gets logged out. **[minor]** Web Locks API / BroadcastChannel guard.
5. **`isTokenExpired()` is never consulted** — refresh is purely reactive (after a 401 round-trip). **[minor]** proactive refresh in the request interceptor when `isTokenExpired()`.
6. **Retry vs non-idempotent methods** — when retry is enabled (esp. via `globalOptions.retry`), POSTs retry on 429/5xx → duplicate side effects (double order/charge). **[minor]** default retry to idempotent methods only (GET/HEAD/PUT/DELETE/OPTIONS) with explicit opt-in for POST; at minimum document. Also `retryStatusCodes: []` meaning "retry everything" is a surprising sentinel.
7. **Devtools captures full payloads/responses** — if enabled in a staging build, tokens/PII in bodies are retained in history (maxHistory 300). **[minor]** `redact?: (record) => record` hook in `DevtoolsOptions`.

---

## 6. Skill drift — `.claude/skills/use-api/SKILL.md` (v1.3)

The skill has fallen behind the library. Concrete issues:

1. **`watch` option does not exist on `useApi`.** Skill lines ~60, 168, 272, 290, 456 pass `watch: [page, sort, filters]` into `useApi*` options. `UseApiOptions` has no `watch` (it was replaced by auto-tracking; only `useApiBatch` keeps a *deprecated* `watch`). Excess-property checks make the skill's own examples TS errors. README already teaches auto-tracking correctly.
2. **Mutation scenarios are a live footgun.** Scenarios 4 ("Save / mutation") and 6 ("Manual request") pass `data: () => form.value` with **no `lazy: true`** — with `lazy: false` default auto-tracking, every form edit fires the POST (confirmed by `useApi.autotrack.test.ts`: "reactive data getter → triggers re-fetch on dep change"). The skill MUST add `lazy: true` to all mutation/manual examples.
3. **No auto-tracking section at all** — the library's flagship feature (and its `ignoreUpdates` escape hatch) is absent from the skill.
4. **Duplicate scenario numbering** — two sections named "### 7.".
5. **Not covered:** `mutate`, `revalidating` (mentioned once in passing), `statusCode`, `initialData`/`initialLoading`, `useGlobalAbort`/`useAbortController`, batch `concurrency`/`progress`/`settled`, `poll` object form (`{ interval, whenHidden }`), `authMode: "public" | "optional"`, global options via `createApi`.
6. Skill version metadata (1.3) has no changelog tie-in to library versions — consider stamping "verified against library X.Y.Z".

---

## 7. Prioritized backlog (with semver impact)

### P0 — correctness/leaks (all `patch`, no API change)
| # | Item | Ref |
|---|---|---|
| 1 | Devtools: don't queue `pendingCalls` when devtools not configured; drop queued entries on destroy; skip state watch when disabled | §4.1 |
| 2 | Filter useApi-only keys out of per-call `...config` before `axios.request()` | §4.3 |
| 3 | Register poll `visibilitychange` listener only when polling is configured | §4.2 |
| 4 | Fix `startLoading` (`initialLoading ?? immediate` dead default) | §4.6 |
| 5 | Refresh-URL match by pathname, not substring | §4.7 |
| 6 | `useAbortController.signal` staleness + `isAbortError` for axios `ERR_CANCELED` | §4.5 |
| 7 | try/catch around localStorage | §4.12 |
| 8 | Fix dangling `poll` JSDoc; dedupe `AuthTokens`/`TOKEN_TYPE`; remove dead refreshPromise API | §4.8, §4.9 |

### P1 — skill & docs (no release)
1. Rewrite SKILL.md: remove `watch`, add auto-tracking section, add `lazy: true` to every mutation/manual example, fix duplicate "7.", add security note (refresh-token storage modes), cover missing options (§6.5).
2. Make `index.ts` exports explicit (replace `export *`) — decide which types are public. *(Careful: technically removing accidental exports is breaking; sequence for v2 or verify nothing consumer-visible disappears.)*
3. Consolidate tests into `__tests__/` (or update testing.instructions.md to match reality — cheaper and honest).
4. Update architecture map with `devtools.ts`, `urlUtils.ts`; fix workflow.md test command (`pnpm --filter ... exec vitest run`).

### P2 — features (each `minor`)
1. **Request deduplication** — share one in-flight promise per cache id (or auto-key); biggest practical win for real apps.
2. **Auto cache keys** — `cache: true` derives key from `url + method + params`; eliminates the manual-id/wrong-params hazard (§3).
3. **Retry backoff** — accept `retryDelay: number | (attempt: number) => number`, add jitter; consider idempotent-only default guard for retries.
4. **Cache hardening** — max entries (LRU) + optional auto-wipe on token clear.
5. **Proactive token refresh** using existing `isTokenExpired()`; cross-tab refresh lock (Web Locks / BroadcastChannel).
6. **Token key namespacing option**; devtools `redact` hook.
7. **Shared focus/online manager** — one document/window listener for the whole app instead of per-instance (currently N listeners for N instances).

### P3 — v2 candidates (each `major` — collect, don't ship piecemeal)
1. Default `lazy: true` for non-GET methods (kills the mutation footgun).
2. Flip token storage default to httpOnly-refresh-cookie mode (`storeRefreshToken: false`).
3. Remove deprecated `useApiBatch` `watch` option (already announced for v2.0).
4. Explicit barrel — stop exporting devtools-internal types.
5. Per-instance (non-singleton) tokenManager bound to each `createApiClient` instance.

---

## 8. Axios → fetch migration assessment (asked 2026-07-06, decision pending)

**Verdict:** feasible, but a major release; the hard part is not the transport swap but the public types, the auth layer, and the test mocks.

- **Narrow waist exists:** the entire library calls axios in exactly ONE place — `axios.request<T>()` in `useApi.ts` (`executeRequest`). Cache/SWR/retry/poll/debounce/autotrack/batch are transport-agnostic.
- **Deep coupling lives in the public API:** `UseApiOptions extends AxiosRequestConfig` (the whole axios config is the public contract), `AxiosResponse` in `UseApiReturn.response` / `onSuccess` / `BatchResultItem.response`, `ApiPluginOptions.axios: AxiosInstance`, `createApiClient`/`setupInterceptors`.
- **Auth layer must be rebuilt:** fetch has no interceptors — the Bearer-inject + 401-refresh-queue logic (the most battle-tested code in the lib) becomes a hand-rolled middleware chain. Highest regression risk.
- **Tests:** ~5,600 lines of tests mock `axios.request` — the mocking layer changes in nearly every file.
- **fetch semantic traps:** resolves (not rejects) on 4xx/5xx → inverts the whole error path; no timeout (need `AbortSignal.timeout` + `AbortSignal.any` merge); no upload progress (Chromium-only request streams); manual params serialization, responseType parsing, XSRF; `credentials` instead of `withCredentials`; aborts throw DOM `AbortError` instead of `ERR_CANCELED`.
- **Gains:** −13–15 KB gzip, one fewer peer dep / supply-chain surface, native streaming, edge/worker compat.
- **Recommended path:** don't "switch" — introduce a **transport adapter** in v2: `transport: { request(config): Promise<NormalizedResponse> }` + own narrow `RequestConfig` type instead of extending `AxiosRequestConfig`; ship the axios adapter as default (one-line migration), add a fetch adapter later. Consumers following the skill's feature-wrapper pattern (use `data`, not `response`) are already nearly transport-agnostic.
- **Effort estimate:** core swap 2–3 days; interceptors→middleware + refresh queue ~1 week (do not rush); v2 types + test-mock rewrite + migration guide 1–2 more weeks. Total: a 2–4 week major-release project.
- **Cheap prep possible in v1.x:** keep the single-call-site discipline; normalize responses/errors internally so only the edges speak axios. Add "transport abstraction" to the Phase 4 / v2 list in the plan.

## 9. Cache deep-dive (asked 2026-07-06 — long-lived / daily data)

**Assessment:** `cacheManager` is clean request-level memoization (50 LOC, predictable), not a query cache. Done right: raw data cached + `select` re-applied per read; write/invalidate only on 2xx; SWR with separate `revalidating`. Structural limits:

1. **In-memory only** — dies on F5, so any long `staleTime` effectively means "until tab close". Long TTLs are fiction without persistence.
2. **No freshness tier:** `swr: true` revalidates on EVERY hit — `staleTime` is a hard expiry (≈ TanStack `gcTime`); the "fresh enough, skip network" tier (≈ TanStack `staleTime`) does not exist.
3. No reactive sharing between instances with the same cache id (no broadcast on `writeCache`); manual keys; no size cap (see §3, Briefs B/D).

**Verified:** `staleTime: Infinity` works today (`Date.now() - cachedAt < Infinity` is always true; entry lives until `invalidateCache`/`clearAllCache`).

**Recipe for daily-changing data (current version, no code changes):**
`cache: { id, staleTime: Infinity, swr: true }` + event-driven `invalidateCache(id)` — instant display, background refresh as safety net, no TTL guessing. Beware: `24_000_000` ms ≈ 6.7h, NOT 24h (`86_400_000`) — duration constants would prevent this bug class.

**How mature libraries do long caches:** two-tier freshness (TanStack `staleTime`/`gcTime`), persistence with version buster (`persistQueryClient`, SWR cache providers), HTTP-level `ETag`/304 + `Cache-Control` (often the RIGHT layer for daily data — browser persists for free, zero client code), calendar-based expiry (`expiresAt` / until-next-publish), event-driven invalidation with infinite TTL.

**Planned:** Brief H (two-tier `freshFor` + `MINUTE/HOUR/DAY` constants) in the plan's Phase 3. `freshFor` is optional, default `0` = current behavior (revalidate on every SWR hit) — zero change for existing users.
**Declined (2026-07-06, maintainer decision):** localStorage cache persistence (was Brief I) — cache stays in-memory only; do not re-propose. For cross-reload longevity prefer HTTP-level `ETag`/304 on the endpoint.

## 10. Notes for future agents

- **Run tests with** `pnpm --filter @ametie/vue-muza-use exec vitest run` (the workflow.md command silently fails on `--run`).
- SPA-only is a **decision**, not a gap — don't propose SSR/Nuxt (see memory `project_spa_decision.md`).
- Never commit/push or bump versions without explicit user confirmation (see memory `feedback_git_workflow.md`); releases are Semantic-Release-driven via conventional commits.
- `dist/` is generated — never edit.
- When fixing anything in §4, follow the house rules: types in `types.ts` first, tests in the five-category matrix (default/enabled/edge/cleanup/integration), JSDoc on public exports, semver stated upfront.
- The interceptor refresh-queue comment (`interceptors.ts:60-63`) and the `ignoreUpdates` implementation comment (`useApi.ts:467-473`) encode hard-won knowledge — read before touching either area.
