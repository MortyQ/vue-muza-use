# Security notes — token storage

Read when configuring `createApiClient` auth, or reviewing where tokens live.

`createApiClient` supports multiple auth modes (see `withCredentials`/`authOptions`
docs). Defaults store BOTH the access and refresh token in localStorage —
acceptable for internal tools, but any XSS can exfiltrate the long-lived refresh
token. For production apps prefer:

```ts
// Hybrid: Bearer access token + httpOnly refresh cookie
createApiClient({
    baseURL: "/api",
    authOptions: {refreshWithCredentials: true},
})
```

## More than one API instance — one auth session (1.9+)

Two `createApiClient({ authOptions })` instances each refresh on their own. With a one-time-use
refresh token the second refresh fails and the user is logged out. Share one session instead:

```ts
export const session = createAuthSession({
    refresh: {url: "/auth/refresh", baseURL: INSIGHTS_URL, withCredentials: true},
});
const insightsApi = createApiClient({baseURL: INSIGHTS_URL, authSession: session});
const toolsApi = createApiClient({baseURL: TOOLS_URL, authSession: session});
```

- One refresh per expiry across every attached instance; the refresh goes to the session's
  backend, each retry to the request's own `baseURL`.
- `authSession` ignores `withAuth`/`authOptions` and does **not** reconfigure token storage —
  pass `storeRefreshToken` to `createAuthSession` to do that explicitly.
- Non-axios consumers reuse the same refresh: `session.fetch` (drop-in fetch, e.g. Apollo
  `HttpLink`), `session.refresh({ staleAccessToken })`, `session.getAuthHeader()` for
  WebSocket `connectionParams`, `session.on("refreshed" | "refreshFailed" | "cleared", ...)`.
- A function `refresh` transport must not send through an attached instance unless the
  request is `authMode: "public"` — use plain axios/fetch for it.
- `crossTab: true` serialises refreshes across tabs (Web Locks) and lets a tab adopt a token
  another tab stored — only with a localStorage-backed store (the default `tokenManager` or a
  `LocalStorageTokenStorage` with custom `keys`); a per-tab token store still refreshes once
  per tab. With several sessions, give each its own `crossTab.lockName`.
- Logout: `session.clear()` (clears tokens, emits `cleared`) plus `clearAllCache()`.

## Second token store — a backend with its own token (1.10+)

When backend B accepts only a token that backend A mints, B's token needs its own store —
saving it through `tokenManager` overwrites A's token:

```ts
import {TokenManager, LocalStorageTokenStorage, createAuthSession} from "@ametie/vue-muza-use";

export const partnerTokens = new TokenManager(new LocalStorageTokenStorage({
    keys: {accessToken: "partner:accessToken", refreshToken: "partner:refreshToken", expiresAt: "partner:expiresAt"},
}));
export const partnerSession = createAuthSession({
    refresh: fetchPartnerToken,             // calls backend A, returns { accessToken, expiresIn }
    tokens: partnerTokens,
    crossTab: {lockName: "my-app:partner-refresh"},
});
const backendB = createApiClient({baseURL: BACKEND_B_URL, authSession: partnerSession});
```

- `keys` must name all three keys, all distinct and never shared with another store — the
  constructor throws on empty or duplicate names, but cannot see other stores.
- `new TokenManager()` with no argument uses the default keys — it is NOT a second store.
- `storeRefreshToken` on `createAuthSession` with a custom `tokens` store throws — set it on
  the `LocalStorageTokenStorage` instead.
- Logout clears only the store you call: clear `tokenManager` (or `session.clear()`) AND
  `partnerTokens.clearTokens()`.
- Token that must not persist: implement `TokenStorage` in memory and pass
  `new TokenManager(memoryStorage)`.

Also call `clearAllCache()` on logout — the in-memory cache is shared across the
whole app and otherwise survives across user sessions on the same page.
