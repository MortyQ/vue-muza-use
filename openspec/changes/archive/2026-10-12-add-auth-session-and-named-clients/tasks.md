# Tasks

Every group except 1 is one commit. Every group ends with Rule 0 of
`.agents/instructions/testing.instructions.md`: full existing suite green **before** new tests,
then new tests, then the full suite again, then `pnpm build`. Report real counts
(files / passed / todo), never a summary from memory. **No existing test file may be edited.**
If one fails, the implementation is wrong — fix the code, not the assertion.

Test command: `pnpm --filter @ametie/vue-muza-use exec vitest run`.

## 1. Baseline (no commit)

- [x] 1.1 On a branch from `origin/main`, run the full suite and record the counts in the PR description draft; verify they are 39 files / 672 passed / 22 todo (if they differ, record the real numbers and use them as the baseline from here on)
- [x] 1.2 `pnpm build` on that commit and copy `packages/use-api/dist/index.d.ts` to a location **outside** the repo (e.g. the session scratchpad) as `index.d.base.ts`; verify the file exists and is non-empty
- [x] 1.3 Read `design.md` D1–D7 and the Backward compatibility table; read `src/features/interceptors.ts`, `src/features/createInstance.ts`, `src/features/cacheManager.ts`, `src/useApi.ts`, `src/useApiBatch.ts` in full before writing code

## 2. AuthSession core — `feat(auth): add createAuthSession with single-flight refresh and lifecycle events`

- [x] 2.1 Add to `src/types.ts`: `RefreshContext`, `RefreshResult`, `DeclarativeRefreshOptions`, `AuthSessionOptions`, `AuthSessionEventMap`, `AuthSessionEvent`, `AuthSession` exactly as in design D2, each with JSDoc; verify `pnpm exec tsc --noEmit -p packages/use-api` passes
- [x] 2.2 Create `src/features/authSession.ts` with `createAuthSession()`: token access via `tokens ?? tokenManager`, optional `storeRefreshToken` applied once at creation, single-flight `refresh()` per D3, `isRefreshing`, `on()` with unsubscribe and listener isolation, `clear()`, auth-monitor calls; verify the existing suite is still green and unchanged
- [x] 2.3 Implement the declarative transport (private interceptor-free axios, payload/withCredentials/extractTokens/onTokenRefreshed identical to `interceptors.ts:171-243`, devtools reporting identical to `interceptors.ts:183-218` and `:254-270`) and the function transport; verify by test 2.6
- [x] 2.4 Implement `crossTab` per D3 (`navigator.locks.request` behind feature detection, default lock name `vue-muza-use:auth-refresh`, adopt-if-token-changed); verify by test 2.7
- [x] 2.5 Export `createAuthSession` from `src/index.ts` (barrel only); verify `pnpm build` emits it in `dist/index.d.ts`
- [x] 2.6 Write `tests/features/authSession.test.ts` covering every scenario of "Session exposes the current token", "Refresh is single-flight", "Refresh transport is configurable", "Refresh failure ends the session", "Session lifecycle events", "Auth monitor parity" in `specs/use-api-auth-session/spec.md`; verify all pass
- [x] 2.7 Write `tests/features/authSession.crossTab.test.ts` with a stubbed `navigator.locks` (serialising fake) covering the three "Cross-tab refresh coordination" scenarios (including that `navigator.locks` is never touched when `crossTab` is off) and the "Cross-tab adoption requires a shared token store" scenario (an in-memory per-tab store serialises but does not adopt); verify all pass
- [x] 2.8 README (`packages/use-api/README.md`, § Authentication & Token Management): new subsection "Auth session (multiple clients, Apollo, WebSocket)" — creating a session, both transport forms, events, `clear()` on logout, `crossTab` (with the shared-token-store requirement and the one-time-refresh-token consequence of a per-tab store), the `authMode: "public"` rule for function transports; the `crossTab` JSDoc states the same limitation; add `createAuthSession` to § API Reference; verify every snippet type-checks by pasting it into a scratch `.ts` file in the playground and running `vue-tsc`/`tsc`
- [x] 2.9 Full suite again (old + new), `pnpm build`; verify old counts unchanged plus the new files

## 3. Attaching instances — `feat(auth): let createApiClient share an AuthSession across instances`

- [x] 3.1 Add `authSession?: AuthSession` to `CreateApiClientOptions` with JSDoc; verify tsc passes
- [x] 3.2 Implement `attach(instance)` in `authSession.ts` per D4 and the `if (authSession)` branch in `createInstance.ts` (the existing body stays byte-identical in the `else` path; `authSession` not spread into `axios.create`; dev-only warning when `authOptions`/`withAuth:false` are also passed; no `tokenManager.setStorage` call); verify the existing suite is green
- [x] 3.3 Write `tests/features/authSession.attach.test.ts`: (a) every scenario of "Attaching an axios instance"; (b) a parity table — the 401 scenarios already covered in `tests/features/interceptors.test.ts` re-expressed as data and run once against a legacy client and once against `createApiClient({ authSession })`, asserting identical observable outcomes (requests sent, headers, retries, rejections, monitor events); (c) two instances, one session, concurrent 401 → one refresh; (d) refresh routed to the session transport, retry routed to the instance `baseURL`; verify all pass
- [x] 3.4 Add to `tests/features/createInstance.test.ts`'s neighbour (new file `tests/features/createInstance.auth.test.ts`, do **not** edit the existing file): without `authSession` the global token storage is configured as before; with `authSession` it is not; verify pass
- [x] 3.5 README: `createApiClient` reference gains `authSession`; a two-backend example (insights + tools sharing one session); verify snippets type-check as in 2.8
- [x] 3.6 Full suite, `pnpm build`; verify counts

## 4. Auth-aware fetch — `feat(auth): add session.fetch for fetch-based consumers`

- [x] 4.1 Implement `session.fetch` per D5 (passthrough on caller-supplied Authorization, one retry, replayable-body rule, `Request` clone, never throws for HTTP status, `options.fetch` resolved at call time, bound property); verify existing suite green
- [x] 4.2 Write `tests/features/authSession.fetch.test.ts` covering every "Auth-aware fetch" scenario plus: caller-supplied Authorization → no refresh; `Request` input is replayed; concurrent 401 from fetch and from an attached axios instance → one refresh; verify all pass
- [x] 4.3 README recipes (docs only, no dependency added): Apollo `HttpLink({ fetch: session.fetch })`; Apollo `ErrorLink` that on `UNAUTHENTICATED` awaits `session.refresh({ staleAccessToken })` and retries; graphql-ws `connectionParams: () => ({ Authorization: session.getAuthHeader() })` + `session.on("refreshed", () => client.terminate())`; fetch-based SSE; verify `package.json` dependencies are unchanged
- [x] 4.4 Full suite, `pnpm build`; verify counts

## 5. Named clients — `feat(clients): route useApi and useApiBatch requests to named axios clients`

- [x] 5.1 Add to `src/types.ts`: `ApiClientRegistry`, `ApiClientName`, `ApiClientConfig`, `ApiErrorContext`; `clients` and the optional third `onError` argument on `ApiPluginOptions`; `client` on `UseApiOptions`, `UseApiBatchOptions`, `BatchRequestConfig`; `"client"` added to the `ExecuteConfig` `Omit` list; all with JSDoc; verify tsc passes
- [x] 5.2 Create `src/features/clientRegistry.ts` per D6 (`DEFAULT_CLIENT`, memoised `resolveClient`, unknown-name error listing registered names, shorthand vs full form detection); add the reserved-`default` check to `createApi` in `src/plugin.ts`; verify existing suite green
- [x] 5.3 Add the optional `client` parameter to `resolveCacheKey` in `src/features/cacheManager.ts` (default/undefined → byte-identical key; named → `auto@<client>:` prefix; manual `id` unchanged); verify `tests/useApi.autoCache.test.ts` still passes unedited
- [x] 5.4 Apply the six `useApi.ts` edits listed in D6 and nothing else; strip `client` from the per-call config; verify existing suite green
- [x] 5.5 Apply the `useApiBatch.ts` edits from D6 (batch-level + per-item client, client-aware `readBatchCache`); verify existing batch suites green
- [x] 5.6 Write `tests/useApi.clients.test.ts` covering every scenario of "Default client is unchanged", "Registering named clients", "Selecting a client per request", "Cache keys are scoped by client", "Per-client error parsing and error context", "Global behaviour applies to every client" (abort, cacheDefaults, retry, devtools reporting via a stubbed devtools bridge, plus 401 retry through the named instance when it is attached to a session); verify all pass
- [x] 5.7 Write `tests/useApiBatch.clients.test.ts` covering "Batch requests support clients"; verify all pass
- [x] 5.8 Write `tests/types/clients.test-d.ts` (or `expectTypeOf` inside a `.test.ts` if `test-d` is not configured — check `vitest.config.ts` first) proving: augmented registry rejects an undeclared name, accepts `"default"` and declared names; unaugmented accepts any string; `ExecuteConfig` has no `client`; verify the type test runs in the suite
- [x] 5.9 README: new § "Multiple backends (named clients)" — registration, `client` option, module augmentation, cache-key format and prefix invalidation, per-client `errorParser`, `onError` context; add options to the `useApi` / `useApiBatch` / `createApi` reference tables; verify snippets type-check as in 2.8
- [x] 5.10 Full suite, `pnpm build`; verify counts

## 6. Compatibility gates and docs sync — `docs(use-api): document auth sessions and named clients in the skill`

- [x] 6.1 Update `.claude/skills/use-api/SKILL.md` and the relevant `references/*.md` (`security.md` for the session, `caching.md` for client-scoped keys, `batch.md` for per-item client, `advanced-options.md` for `clients`); verify each new statement matches the implemented behaviour by pointing to the test that proves it
- [x] 6.2 Build the branch and diff `dist/index.d.ts` against `index.d.base.ts` from 1.2; verify the diff contains **only added lines** apart from the additive optional fields/parameters listed in the proposal (any removed or changed pre-existing signature is a blocker)
- [x] 6.3 Run `git diff --exit-code origin/main -- packages/use-api/src/features/interceptors.ts packages/use-api/src/features/tokenManager.ts`; verify exit code 0
- [x] 6.4 Run `git diff --stat origin/main -- packages/use-api/tests` and verify only new files appear (no modified existing test file)
- [ ] 6.5 Optional: add a playground page with two mock backends sharing one session; verify manually that concurrent 401s produce one refresh in the network panel
- [x] 6.6 Final full suite + `pnpm build`; put baseline vs final counts and the outputs of 6.2–6.4 in the PR description

## Workflow follow-up

- Owner reviews the PR; semantic-release publishes 1.9.0 on merge to `main` (never bump the version by hand).
- `pnpm openspec sync` the delta specs into `openspec/specs/`, then archive the change.
- so-platform opens its own OpenSpec change to adopt 1.9.0 (insights-client: session + `tools` client + Apollo/WS).
