## ADDED Requirements

### Requirement: Default token storage is unchanged
A `LocalStorageTokenStorage` created without `keys`, and the exported `tokenManager` singleton, SHALL read, write and remove exactly the keys `accessToken`, `refreshToken` and `tokenExpiresAt` with the same values, the same `storeRefreshToken` behaviour, the same 5-second expiry buffer and the same storage-unavailable degradation as in 1.9.x.

#### Scenario: Existing token suite passes unmodified
- **WHEN** the full pre-existing test suite runs with no test file edited
- **THEN** every test passes with the same counts as before the change, plus only newly added files

#### Scenario: Default keys are written
- **WHEN** `new LocalStorageTokenStorage().setTokens({ accessToken: "a", refreshToken: "r", expiresIn: 60 })` is called
- **THEN** localStorage contains `accessToken = "a"`, `refreshToken = "r"`, and `tokenExpiresAt` set to now + 60 000 ms, and no other key

### Requirement: Custom storage keys
`LocalStorageTokenStorage` SHALL accept a `keys` option naming all three keys (`accessToken`, `refreshToken`, `expiresAt`). With `keys` set, every read, write and remove of that instance SHALL use only those names, and `storeRefreshToken` SHALL keep its meaning for the custom refresh key.

#### Scenario: Custom keys are used
- **WHEN** a storage with `keys: { accessToken: "bAccess", refreshToken: "bRefresh", expiresAt: "bExpiresAt" }` stores `{ accessToken: "b1", expiresIn: 60 }`
- **THEN** localStorage contains `bAccess = "b1"` and `bExpiresAt`, and `getAccessToken()` and `getTokenExpiresAt()` read them back

#### Scenario: Custom keys with storeRefreshToken false
- **WHEN** a storage with custom `keys` and `storeRefreshToken: false` stores and then clears `{ accessToken: "b1", refreshToken: "r1" }`
- **THEN** the custom refresh key is never written or removed, and `getRefreshToken()` returns `null`

#### Scenario: Storage unavailable with custom keys
- **WHEN** localStorage throws on every access and a storage with custom `keys` is read, written and cleared
- **THEN** no call throws, reads return `null`, and `isTokenExpired()` returns `false`

### Requirement: Stores with different keys are independent
Two token stores whose key sets do not overlap SHALL never observe or modify each other's tokens, including through `clearTokens()` and through expiry bookkeeping.

#### Scenario: Second store does not touch the default store
- **WHEN** `tokenManager.setTokens({ accessToken: "a1", expiresIn: 3600 })` is followed by `new TokenManager(new LocalStorageTokenStorage({ keys })).setTokens({ accessToken: "b1", expiresIn: 60 })` with non-default `keys`
- **THEN** `tokenManager.getAccessToken()` is still `"a1"` and `tokenManager.getTokenExpiresAt()` is unchanged

#### Scenario: Clearing one store keeps the other
- **WHEN** both stores hold tokens and `clearTokens()` is called on the second store
- **THEN** the default store still holds `"a1"` and its expiry, and the second store holds nothing

#### Scenario: Expiry is per store
- **WHEN** the second store's token has expired and the default store's has not
- **THEN** the second store's `isTokenExpired()` is `true` and the default store's is `false`

### Requirement: Invalid keys are rejected at construction
The `LocalStorageTokenStorage` constructor SHALL throw a `TypeError` naming the offending role(s) when any key in `keys` is not a non-empty string, or when two roles share one key name.

#### Scenario: Empty key name
- **WHEN** `new LocalStorageTokenStorage({ keys: { accessToken: "", refreshToken: "r", expiresAt: "e" } })` is called
- **THEN** it throws a `TypeError` mentioning `accessToken`

#### Scenario: Two roles share a key
- **WHEN** `keys.accessToken` and `keys.expiresAt` are the same string
- **THEN** the constructor throws a `TypeError` mentioning both roles, and localStorage is not touched

#### Scenario: Unused refresh key still must be distinct
- **WHEN** `storeRefreshToken` is `false` and `keys.refreshToken` equals `keys.accessToken`
- **THEN** the constructor still throws a `TypeError` mentioning both roles

### Requirement: Token store classes are public
The package SHALL export `TokenManager` and `LocalStorageTokenStorage` as values, and `TokenStorage`, `TokenStorageKeys` and `LocalStorageTokenStorageOptions` as types, so an app can build additional stores (including a custom `TokenStorage`) and pass them to `createAuthSession({ tokens })`. The `tokenManager` singleton export SHALL remain and SHALL remain an instance of the exported `TokenManager`.

#### Scenario: Building a second store from the package entry
- **WHEN** an app imports `TokenManager` and `LocalStorageTokenStorage` from `@ametie/vue-muza-use` and passes `new TokenManager(new LocalStorageTokenStorage({ keys }))` as `tokens` to `createAuthSession`
- **THEN** it type-checks, and the session reads and writes only that store's keys

#### Scenario: Custom TokenStorage implementation
- **WHEN** an app implements `TokenStorage` in memory and passes `new TokenManager(memoryStorage)` to `createAuthSession({ tokens })`
- **THEN** the session reads and writes that storage and localStorage is never touched by it

#### Scenario: Singleton identity
- **WHEN** the app checks `tokenManager instanceof TokenManager`
- **THEN** it is `true`

#### Scenario: Public type surface only grows
- **WHEN** `dist/index.d.ts` after the change is compared with the build before it
- **THEN** every previously exported name is still exported with the same signature, and the only differences are the new exports
