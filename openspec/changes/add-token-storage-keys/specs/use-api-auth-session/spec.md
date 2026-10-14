## ADDED Requirements

### Requirement: storeRefreshToken applies only to the default store
`createAuthSession` SHALL apply `storeRefreshToken` by replacing the storage of the `tokenManager` singleton, exactly as in 1.9.x, when `tokens` is omitted or is the singleton itself. When `tokens` is any other `TokenManager` and `storeRefreshToken` is set, `createAuthSession` SHALL throw a `TypeError` telling the caller to configure `storeRefreshToken` on the storage passed to that `TokenManager`, and SHALL NOT modify any store.

#### Scenario: Default store, unchanged behaviour
- **WHEN** `createAuthSession({ refresh, storeRefreshToken: false })` is called without `tokens`
- **THEN** the singleton stores only the access token, as in 1.9.x

#### Scenario: Singleton passed explicitly, unchanged behaviour
- **WHEN** `createAuthSession({ refresh, tokens: tokenManager, storeRefreshToken: false })` is called
- **THEN** no error is thrown and the singleton stores only the access token, as in 1.9.x

#### Scenario: Custom store with storeRefreshToken
- **WHEN** `createAuthSession({ refresh, tokens: new TokenManager(new LocalStorageTokenStorage({ keys })), storeRefreshToken: false })` is called
- **THEN** it throws a `TypeError`, and neither the custom store nor the singleton has its storage replaced

#### Scenario: Custom store without storeRefreshToken
- **WHEN** `createAuthSession({ refresh, tokens: customStore })` is called
- **THEN** no error is thrown and the custom store's storage, including its keys, is left exactly as passed

## MODIFIED Requirements

### Requirement: Cross-tab adoption requires a shared token store
Token adoption SHALL be guaranteed only when the session's token store is shared between tabs, meaning it is backed by a `LocalStorageTokenStorage`: the default `tokenManager`, or any `TokenManager` built on a `LocalStorageTokenStorage` with custom `keys`. With a per-tab store (in-memory or another custom `TokenStorage`) the lock SHALL still serialise refreshes, but each tab performs its own refresh. The limitation SHALL be documented on the `crossTab` option and in the README, together with the advice to give each session its own `crossTab.lockName` so that refreshes of unrelated sessions are not serialised behind one lock.

#### Scenario: Per-tab token store does not adopt
- **WHEN** `crossTab` is enabled with a token store that is not shared between tabs, and tab B acquires the lock after tab A has refreshed
- **THEN** B still sees its stale token, sends its own refresh request after A's has settled (never concurrently), and no error is raised by the session itself

#### Scenario: Custom-key localStorage store adopts
- **WHEN** `crossTab` is enabled on a session whose `tokens` is a `TokenManager` over a `LocalStorageTokenStorage` with custom `keys`, and tab B acquires the lock after tab A stored a new token under those keys
- **THEN** B performs no refresh request and resolves with the token tab A stored

#### Scenario: Default store adoption unchanged
- **WHEN** the existing cross-tab tests run against the default `tokenManager`
- **THEN** they pass unmodified
