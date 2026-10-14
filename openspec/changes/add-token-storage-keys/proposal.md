# Proposal

[minor] Let an app keep more than one token store: export `TokenManager` and
`LocalStorageTokenStorage`, and let `LocalStorageTokenStorage` take custom storage keys. Purely
additive. Without the new option every key, every stored value and the `tokenManager` singleton
stay byte-for-byte identical. Package: `@ametie/vue-muza-use` (`packages/use-api`) only.

## Why

1.9 made a second backend a first-class case (`createAuthSession`, named clients). That only works
when both backends accept the same token. Some backends issue their own token instead: the app
calls backend A with A's token to get a short-lived token for backend B, and then calls B with it.
Such an app needs **two token stores side by side**, and today it cannot have them:

- `LocalStorageTokenStorage` writes to three hard-coded keys (`accessToken`, `refreshToken`,
  `tokenExpiresAt`, the module constants in `src/features/tokenManager.ts`). Two instances write
  over each other: storing B's token **replaces A's token**, so every request to A then goes out
  with B's token.
- Only the `tokenManager` singleton is exported. The class itself is not (`src/index.ts`), so an
  app cannot build a second `TokenManager`. `AuthSessionOptions.tokens` is typed as `TokenManager`,
  and because the class has private members it cannot be satisfied structurally either. The README
  already says "A custom store goes in `tokens` (a `TokenManager` instance)", which no consumer
  can actually do. This change makes that sentence true.
- Swapping the singleton's storage with `tokenManager.setStorage()` is not a way out, because the
  singleton is the store of the app's main session.

What follows is the same store with its own keys: the same localStorage persistence, the same
cross-tab sharing, and the same `expiresIn` → `expiresAt` bookkeeping as the main token, and no
collision with it.

## What Changes

- `LocalStorageTokenStorage` accepts a new constructor option `keys`, a complete
  `TokenStorageKeys` object (`accessToken`, `refreshToken`, `expiresAt`). Every read, write and
  remove goes to these keys. Without `keys` the three default keys are used exactly as today.
- Invalid `keys` (an empty name, or two roles sharing one name) throw a `TypeError` in the
  constructor rather than corrupting storage later.
- `createAuthSession({ tokens, storeRefreshToken })`: today `storeRefreshToken` replaces the store's
  storage with a default-keyed `LocalStorageTokenStorage`. On a store that is not the
  `tokenManager` singleton this would silently drop the store's custom keys and start writing over
  the main token. That combination now throws a `TypeError` at creation, and the message says to set
  `storeRefreshToken` on the storage instead. The singleton path, the only one possible today,
  is unchanged.
- New exports from `src/index.ts`:
  - `TokenManager` (class, value export), already declared in `dist/index.d.ts` but not exported;
  - `LocalStorageTokenStorage` (class, value export);
  - `type TokenStorage` (interface, so an app can write its own storage, for example in memory);
  - `type TokenStorageKeys` (new);
  - `type LocalStorageTokenStorageOptions` (new, named type for the existing constructor options
    plus `keys`).
- No public export is changed or deprecated. `tokenManager`, its storage and its behaviour are
  untouched.
- Docs: the README (§ tokenManager, § Token storage of the auth session, § API Reference),
  JSDoc on every new or touched symbol, the `use-api` skill (`.claude/skills/use-api/`) and the
  repo's own instructions (`project.md`, `library-architecture.instructions.md`). Every example
  uses neutral names (`backendB`, `partnerAccessToken`), never a consumer's product name.

## Out of scope

- A key **prefix** option, an in-memory `TokenStorage` implementation, and an `isTokenExpired`
  buffer option. An app writes these in a few lines on top of the exported pieces; see design D4.
- Accepting an absolute `expiresAt` in `setTokens`. `AuthTokens.expiresIn` stays the only expiry
  input; converting from an absolute time is a one-liner in the app.
- Any change to `createApiClient`'s implicit `tokenManager.setStorage()` (legacy path, kept as is).
- Removing the deprecated `refreshPromise` helpers on `TokenManager` (scheduled for 2.0).
- A refresh scheme for B's token (proactive refresh, a single-flight token fetch). That is
  consumer logic: with these exports it is a `createAuthSession({ refresh: fn, tokens })` or a few
  lines in the app.

## Capabilities

### New Capabilities

- `use-api-token-storage`: the token store: where tokens live, under which keys, how expiry is
  kept, and how several stores coexist.

### Modified Capabilities

- `use-api-auth-session`: `storeRefreshToken` combined with a custom `tokens` store is rejected;
  cross-tab adoption works with any store shared between tabs, not only the singleton.

## Impact

- `packages/use-api/src/features/tokenManager.ts`: key resolution and validation.
- `packages/use-api/src/features/authSession.ts`: the `storeRefreshToken` + custom `tokens` guard.
- `packages/use-api/src/types.ts`: `TokenStorageKeys`, `LocalStorageTokenStorageOptions`;
  `AuthSessionOptions.tokens` / `storeRefreshToken` JSDoc.
- `packages/use-api/src/index.ts`: new exports.
- `packages/use-api/tests/features/`: new test files only. No existing test file is edited.
- Docs listed above. Motivating use: a downstream app that calls a second backend with a token
  minted by the first will create a second store for it once this is released.
