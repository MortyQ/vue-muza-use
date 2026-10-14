# Design

## Context

`src/features/tokenManager.ts` has three parts:

- `TokenStorage`, the storage interface (exported from the module, not from the package);
- `LocalStorageTokenStorage`, which reads and writes three module constants: `ACCESS_TOKEN_KEY`
  (`"accessToken"`), `REFRESH_TOKEN_KEY` (`"refreshToken"`), `TOKEN_EXPIRES_KEY`
  (`"tokenExpiresAt"`). It wraps every call in `safeGetItem` / `safeSetItem` / `safeRemoveItem`;
- `TokenManager`, a thin facade over a storage, with the singleton `tokenManager = new TokenManager()`.

The package barrel exports only `tokenManager`. `createAuthSession` accepts `tokens?: TokenManager`.
When `storeRefreshToken` is set, it calls
`tokens.setStorage(new LocalStorageTokenStorage({ storeRefreshToken }))`
(`src/features/authSession.ts`, start of `createAuthSession`). The legacy `createApiClient` calls
`tokenManager.setStorage(...)` on the singleton (`src/features/createInstance.ts`).

The motivating consumer has two backends. Backend A issues a normal session token, and backend B
accepts only a short-lived token that A mints on request. Both tokens must persist and be shared
between tabs in the same way, and neither may overwrite the other.

## Goals / Non-Goals

**Goals**
- Two or more `TokenManager`s backed by localStorage coexist in one origin without touching each
  other's keys.
- Every way of building a store is a public, documented export.
- No observable change for an app that does not use the new option.

**Non-Goals**
- New storage backends, a prefix option, a configurable expiry buffer, absolute `expiresAt`
  input (see D4).
- Any refresh logic for a second token. That belongs to the consumer, built on
  `createAuthSession({ tokens })` or its own code.

## Decisions

### D1 — `keys` is a complete object, not a partial override

`LocalStorageTokenStorage` gets `keys?: TokenStorageKeys`, and `TokenStorageKeys` requires all three
names:

```ts
// types.ts
/** localStorage key names used by one `LocalStorageTokenStorage`. All three are required. */
export interface TokenStorageKeys {
    /** Key of the access token. Default store: `"accessToken"`. */
    accessToken: string;
    /** Key of the refresh token; unused when `storeRefreshToken` is `false`. Default store: `"refreshToken"`. */
    refreshToken: string;
    /** Key of the expiry timestamp (ms since epoch). Default store: `"tokenExpiresAt"`. */
    expiresAt: string;
}

/** Options of the `LocalStorageTokenStorage` constructor. */
export interface LocalStorageTokenStorageOptions {
    /** Keep the refresh token in localStorage. `false`: it lives in an httpOnly cookie. Default: `true`. */
    storeRefreshToken?: boolean;
    /** Custom key names. Default: `accessToken` / `refreshToken` / `tokenExpiresAt`. */
    keys?: TokenStorageKeys;
}
```

- **ADVOCATE (complete object):** a partial override (`keys: { accessToken: "b" }`) silently keeps
  the default `tokenExpiresAt`. The second store's `setTokens({ expiresIn })` would then overwrite
  the main store's expiry, the exact collision this change exists to remove, only quieter.
  Requiring all three makes the collision impossible to write by accident. It also lets an app
  map onto key names it already has in production, which a prefix cannot do.
- **SKEPTIC:** it is more typing, and `refreshToken` must be named even with
  `storeRefreshToken: false`, where it is never used.
- **VERDICT:** complete object. Three short strings are a fair price for making the dangerous
  configuration unrepresentable. The JSDoc says the refresh key is ignored when
  `storeRefreshToken` is `false`.

The default key set is built from the existing constants, which stay exported from the module
under their current names, so the default path reads the same identifiers as today.

### D2 — Validation in the constructor

The constructor throws `TypeError` when a key is not a non-empty string, or when two roles share
one name (for example `accessToken === expiresAt`). The message names the offending role or roles.

The duplicate check covers all three roles, `refreshToken` included, even when
`storeRefreshToken` is `false` and the refresh key is never touched. This is deliberate: the rule
stays one line ("three distinct names"), and a store whose `storeRefreshToken` is later flipped to
`true` cannot start writing its refresh token over its own access token or expiry.

Validation does **not** compare against other instances. Two stores configured with the same
names are a consumer error that the library cannot see without a global registry, and a registry
would be state that tests and SSR would have to reset. The README warns about it explicitly instead.

- **ADVOCATE:** a typo such as `""` or a copy-pasted key fails at app start, not as a corrupted
  session hours later.
- **SKEPTIC:** throwing in a constructor that used to be infallible.
- **VERDICT:** throw. The constructor is only reachable through the new export or the new
  option, so no existing call can hit the throw (the default keys are valid by construction).

### D3 — `storeRefreshToken` with a custom `tokens` store throws

Today `createAuthSession({ tokens, storeRefreshToken })` replaces the store's storage with a
default-keyed `LocalStorageTokenStorage`. With D1 in place that would silently discard custom keys
and point the second store at the main store's keys.

New rule, in `createAuthSession`: if `storeRefreshToken !== undefined` **and** `tokens` is given
**and** `tokens !== tokenManager` (the singleton), throw `TypeError` saying "configure
`storeRefreshToken` on the `LocalStorageTokenStorage` passed to this `TokenManager`".

- **ADVOCATE:** the alternative fails silently and in the worst way: requests to backend A go
  out with B's token.
- **SKEPTIC (alternative: rebuild the storage with the store's existing keys):** that needs
  `TokenManager` to expose its storage's keys, which couples the facade to one storage
  implementation. A custom `TokenStorage` (for example in memory) has no keys at all.
- **SKEPTIC (alternative: ignore `storeRefreshToken` for custom stores):** silent ignore is the
  same class of bug as silent overwrite.
- **VERDICT:** throw. Before this change no public API could produce a non-singleton
  `TokenManager`, so no existing call site reaches the new branch. `tokens: tokenManager` (the
  singleton, passed explicitly) keeps applying `storeRefreshToken` exactly as today.

### D4 — What is deliberately not added

| Idea | Why not |
|---|---|
| `keyPrefix` option | Cannot express existing key names; `""` reproduces the collision; D1 covers it. |
| Built-in `MemoryTokenStorage` | Only for a store that must not persist; `TokenStorage` is now exported and a memory implementation is about 15 lines. The README shows it. |
| `isTokenExpired(bufferMs)` | The 5 s buffer is internal behaviour of the default store. A consumer that wants "refresh 60 s early" reads `getTokenExpiresAt()` and compares. A second knob for the same fact would drift. |
| `setTokens({ expiresAt })` absolute | `AuthTokens` is shared with refresh responses and the legacy interceptor; `expiresIn = expiresAt - Date.now() / 1000` is a one-liner at the call site. |

### D5 — Layers

| Piece | Layer (per `library-architecture.instructions.md`) |
|---|---|
| `TokenStorageKeys`, `LocalStorageTokenStorageOptions` | `types.ts` (Rule 1) |
| `TokenStorage` interface | **moves to `types.ts`** (Rule 1: public types live there). `features/tokenManager.ts` keeps `export type { TokenStorage } from "../types"`, so internal imports keep working unchanged. |
| Key resolution and validation | `features/tokenManager.ts` (private helper next to `LocalStorageTokenStorage`) |
| `storeRefreshToken` guard | `features/authSession.ts` |
| Exports | `index.ts`, barrel only (Rule 3): `TokenManager`, `LocalStorageTokenStorage` as values. The types arrive through the existing `export * from "./types"`. |

`TokenManager` and `LocalStorageTokenStorage` become intentionally public (Rule 4). Their JSDoc is
rewritten for consumers: what they are for, when to create a second instance, and that the
singleton is the default store of every session and legacy client.

## Backward compatibility

| Existing behaviour that must stay identical | Proven by |
|---|---|
| Default keys `accessToken` / `refreshToken` / `tokenExpiresAt`, same values written | `tests/features/tokenManager.test.ts` (unchanged, green) plus a new test: a store built with no options writes exactly those three keys |
| `storeRefreshToken: false` never writes or removes the refresh key | `tests/features/tokenManager.test.ts` |
| 5 s expiry buffer, "no expiry stored → not expired" | `tests/features/tokenManager.test.ts` § isTokenExpired |
| Storage-unavailable degradation (no throw) | `tests/features/tokenManager.test.ts` § storage unavailable, plus a new test with custom keys |
| `tokenManager` singleton identity and default storage | `tests/features/authSession.test.ts` ("Token written through tokenManager is visible") |
| `createAuthSession({ storeRefreshToken })` without `tokens`, and with `tokens: tokenManager` | `tests/features/authSession.test.ts`; new test for the explicit-singleton case |
| Legacy `createApiClient` storage configuration | `tests/features/createInstance.test.ts`, `tests/features/createInstance.auth.test.ts` |
| Cross-tab adoption with the default store | `tests/features/authSession.crossTab.test.ts` |
| Whole suite | Rule 0 of `testing.instructions.md`: the full existing suite is green with **no existing test file edited**, counts recorded before and after |
| Public type surface only grows | `dist/index.d.ts` diffed against the pre-change build: additions only |

## Risks / Trade-offs

- **Two stores configured with identical keys:** not detectable (D2). Mitigated by the README
  warning and the D1 example using clearly distinct names.
- **`new TokenManager()` with no arguments shares the singleton's keys:** its default storage is a
  default-keyed `LocalStorageTokenStorage`, so once the class is public the most natural call a
  consumer writes for "a second store" collides with the main store. The default cannot change
  (existing tests build `new TokenManager()` as a plain default store, and changing it would be
  breaking). Mitigated in documentation: the `TokenManager` constructor JSDoc and the README
  "A second token store" section state that a no-argument instance reads and writes the same keys
  as `tokenManager`, and that a second store must be built as
  `new TokenManager(new LocalStorageTokenStorage({ keys }))`.
- **A second session with `crossTab` uses the default lock name:** refreshes of unrelated
  sessions would be serialised behind one lock. That is harmless but slower. The README section for
  a second store says to pass a distinct `crossTab.lockName`. This is documentation only, no code
  change.
- **Logout:** clearing the main session does not clear a second store. The README example shows
  clearing both on logout. Consumer responsibility, stated explicitly.

## Migration Plan

None required: the change is additive. Released as a minor through semantic-release from a `feat`
commit.
