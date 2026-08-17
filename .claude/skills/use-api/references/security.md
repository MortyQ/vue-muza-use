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

Also call `clearAllCache()` on logout — the in-memory cache is shared across the
whole app and otherwise survives across user sessions on the same page.
