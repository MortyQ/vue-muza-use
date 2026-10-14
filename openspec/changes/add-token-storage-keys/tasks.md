# Tasks

Every group except 1 is one commit. Every group ends with Rule 0 of
`.agents/instructions/testing.instructions.md`: the full existing suite green **before** new
tests, then the new tests, then the full suite again, then `pnpm build`. Report real counts
(files / passed / todo), never a summary from memory. **No existing test file may be edited.**
If one fails, the implementation is wrong: fix the code, not the assertion.

Test command: `pnpm --filter @ametie/vue-muza-use exec vitest run`.

Naming rule for code, tests and docs: the library knows nothing about its consumers. Examples use
neutral names (`backendB`, `partnerAccessToken`, `partner:accessToken`), never a consumer's product
name.

## 1. Baseline (no commit)

- [x] 1.1 On a branch from `origin/main`, run the full suite and record the counts (files / passed / todo) for the PR description
- [x] 1.2 `pnpm build` and copy `packages/use-api/dist/index.d.ts` to a location **outside** the repo as `index.d.base.ts`; verify it exists and is non-empty
- [x] 1.3 Read `proposal.md`, `design.md` (D1–D5, Backward compatibility) and both delta specs; read `src/features/tokenManager.ts`, `src/features/authSession.ts`, `src/features/createInstance.ts`, `src/index.ts` and `tests/features/tokenManager.test.ts` in full before writing code

## 2. Custom storage keys — `feat(auth): let LocalStorageTokenStorage use custom storage keys`

- [x] 2.1 `src/types.ts`: move the `TokenStorage` interface here (with JSDoc for every method); add `TokenStorageKeys` and `LocalStorageTokenStorageOptions` exactly as in design D1, with JSDoc stating the defaults and that `refreshToken` is ignored when `storeRefreshToken` is `false`. In `src/features/tokenManager.ts` replace the local interface with `export type { TokenStorage } from "../types"`; verify `pnpm exec tsc --noEmit -p packages/use-api` passes
- [x] 2.2 `src/features/tokenManager.ts`: `LocalStorageTokenStorage` takes `LocalStorageTokenStorageOptions`, resolves its key set once in the constructor (default set built from the existing `ACCESS_TOKEN_KEY` / `REFRESH_TOKEN_KEY` / `TOKEN_EXPIRES_KEY` constants, which stay exported under the same names), validates per design D2 (private helper, `TypeError` naming the role or roles), and uses the resolved keys in every method. No other behaviour changes: same `safe*` wrappers, same 5 s buffer, same `storeRefreshToken` rules. Rewrite the class JSDoc for consumers (what it is, the `keys` option, the "two stores must not share key names" warning); verify the existing suite is green with no test edited
- [x] 2.3 New `tests/features/tokenManager.keys.test.ts`: every scenario of "Default token storage is unchanged" (the default-keys one), "Custom storage keys", "Stores with different keys are independent" and "Invalid keys are rejected at construction" in `specs/use-api-token-storage/spec.md`; the storage-unavailable scenario stubs localStorage the same way the existing file does; verify all pass
- [x] 2.4 Full suite and `pnpm build`; verify old counts unchanged plus the new file

## 3. Public store classes and the session guard — `feat(auth): export TokenManager and LocalStorageTokenStorage`

- [ ] 3.1 `src/features/authSession.ts`: the `storeRefreshToken` guard per design D3 (throw `TypeError` before any storage is touched when `tokens` is given, is not the `tokenManager` singleton, and `storeRefreshToken !== undefined`). Update the JSDoc of `AuthSessionOptions.tokens` and `.storeRefreshToken` in `src/types.ts` to say so, and the `crossTab` JSDoc to say adoption works with any `LocalStorageTokenStorage`-backed store and to recommend a distinct `lockName` per session; verify the existing suite is green
- [ ] 3.2 `src/index.ts` (barrel only): export `TokenManager` and `LocalStorageTokenStorage` next to `tokenManager`. The types already flow through `export * from "./types"`. Rewrite the `TokenManager` class JSDoc for consumers (the singleton is the default store of every session and legacy client; build a second instance for a second token). The constructor JSDoc warns that `new TokenManager()` with no argument uses the default keys, i.e. the same keys as `tokenManager`, and shows `new TokenManager(new LocalStorageTokenStorage({ keys }))` as the way to build a second store (design, Risks); verify `pnpm build` emits the new exports in `dist/index.d.ts`
- [ ] 3.3 New `tests/features/authSession.tokens.test.ts`: every scenario of "storeRefreshToken applies only to the default store" in `specs/use-api-auth-session/spec.md`; "Token store classes are public" (import from `src/index.ts`, a second store passed as `tokens` and the session confined to its keys, an in-memory `TokenStorage`, `tokenManager instanceof TokenManager`); verify all pass
- [ ] 3.4 New `tests/features/authSession.crossTab.keys.test.ts`: the "Custom-key localStorage store adopts" scenario, using the same serialising `navigator.locks` fake as `tests/features/authSession.crossTab.test.ts` (copy the helper, do not edit that file); verify it passes
- [ ] 3.5 `pnpm build`, then diff `dist/index.d.ts` against `index.d.base.ts` from 1.2: every old export is unchanged and the only additions are `TokenManager`, `LocalStorageTokenStorage`, `TokenStorage`, `TokenStorageKeys`, `LocalStorageTokenStorageOptions` (the "Public type surface only grows" scenario); paste the diff summary into the PR description
- [ ] 3.6 Full suite again; verify counts

## 4. Documentation — `docs(use-api): document custom token stores`

- [ ] 4.1 `packages/use-api/README.md`, § "tokenManager — Manual Token Control": a new subsection "A second token store" covering when you need one (a backend that only accepts a token another backend mints), `new TokenManager(new LocalStorageTokenStorage({ keys }))`, the complete-keys rule and why, the "never reuse key names" warning (including that `new TokenManager()` with no argument shares the default keys with `tokenManager`), clearing both stores on logout, and converting an absolute expiry to `expiresIn`
- [ ] 4.2 Same README, § auth session "Token storage": replace "A custom store goes in `tokens` (a `TokenManager` instance)" with a working example of `createAuthSession({ refresh: fn, tokens: secondStore })`; state the `storeRefreshToken` + custom `tokens` `TypeError` and where to set it instead; in § "Cross-tab refresh" say adoption works with any localStorage-backed store and recommend a distinct `crossTab.lockName` per session; include the in-memory `TokenStorage` example (about 15 lines) for stores that must not persist
- [ ] 4.3 Same README, § API Reference: entries for `TokenManager` (constructor, methods), `LocalStorageTokenStorage` (options table: `storeRefreshToken`, `keys`), the types `TokenStorage`, `TokenStorageKeys`, `LocalStorageTokenStorageOptions`; the `createAuthSession` options table row for `tokens` links to them
- [ ] 4.4 `.claude/skills/use-api/`: in `references/security.md`, update the cross-tab note (any localStorage-backed store, distinct `lockName`) and add a "Second token store" section (custom keys, never shared names, clear on logout); add a pointer line in `SKILL.md` where token storage is mentioned
- [ ] 4.5 `.agents/instructions/project.md` (exports table: `TokenManager`, `LocalStorageTokenStorage`) and `library-architecture.instructions.md` (the `tokenManager.ts` line in the layer map; `TokenStorage` now lives in `types.ts`); `CHANGELOG.md` is left to semantic-release
- [ ] 4.6 Type-check every new README snippet: paste them into a scratch `.ts` file in `packages/playground` importing from the built package and run `vue-tsc --noEmit` (or `tsc`); delete the scratch file; verify zero errors
- [ ] 4.7 `pnpm openspec validate add-token-storage-keys --strict` passes
