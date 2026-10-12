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
  another tab stored — only with the default localStorage-backed `tokenManager`; a per-tab
  token store still refreshes once per tab.
- Logout: `session.clear()` (clears tokens, emits `cleared`) plus `clearAllCache()`.

Also call `clearAllCache()` on logout — the in-memory cache is shared across the
whole app and otherwise survives across user sessions on the same page.
