# Spec Delta

## Purpose

A single authentication session that owns the access token, performs token refresh exactly once
per expiry no matter how many axios instances or non-axios consumers observe the 401, and tells
interested parties when the token changes or the session ends.

## ADDED Requirements

### Requirement: Legacy client auth is unchanged
A client created with `createApiClient()` without the `authSession` option SHALL behave exactly as in
1.8.x: same interceptors, same refresh request, same queueing, same `tokenManager` storage
configuration, same callbacks.

#### Scenario: Existing suite passes unmodified
- **WHEN** the full pre-existing test suite runs against 1.9 with no test file edited
- **THEN** every test passes with the same counts as on 1.8.x (39 files, 672 passed, 22 todo at the time of writing, plus only newly added files)

#### Scenario: Legacy client still configures global token storage
- **WHEN** `createApiClient({ authOptions: { refreshWithCredentials: true } })` is called without `authSession`
- **THEN** `tokenManager` stores only the access token, as in 1.8.x

### Requirement: Session exposes the current token
A session SHALL expose the current access token and Authorization header value, read from its token store at call time. By default the store is the exported `tokenManager` singleton, so tokens written through `tokenManager.setTokens()` are visible to the session and vice versa.

#### Scenario: Token written through tokenManager is visible
- **WHEN** the app calls `tokenManager.setTokens({ accessToken: "a1" })` and then reads `session.getAccessToken()` on a session created without a custom store
- **THEN** it returns `"a1"`

#### Scenario: No token
- **WHEN** no access token is stored
- **THEN** `session.getAccessToken()` and `session.getAuthHeader()` return `null`

### Requirement: Refresh is single-flight
`session.refresh()` SHALL return a promise of the new access token. While a refresh is in flight, every further call — direct, or triggered by any attached instance or by the session's fetch — SHALL await that same refresh instead of starting another.

#### Scenario: Concurrent callers share one refresh
- **WHEN** `session.refresh()` is called three times before the first refresh settles
- **THEN** the refresh transport is invoked once and all three promises resolve to the same token

#### Scenario: Two attached instances get 401 at the same time
- **WHEN** two axios instances attached to one session each receive a 401 concurrently
- **THEN** exactly one refresh request is sent and both original requests are retried with the new token

#### Scenario: Sequential refreshes
- **WHEN** a refresh has settled and `session.refresh()` is called again
- **THEN** a new refresh is performed

### Requirement: Refresh transport is configurable
A session SHALL accept either a declarative refresh description (URL, optional base URL, credentials flag, payload, token extractor) or a function that performs the refresh and returns tokens. The declarative form SHALL send the same request and accept the same response shapes as the 1.8.x interceptor.

#### Scenario: Declarative refresh
- **WHEN** the session is configured with `refresh: { url: "/auth/refresh", baseURL: "/api", withCredentials: true }` and a refresh is triggered
- **THEN** a POST is sent to `/api/auth/refresh` with credentials, without an Authorization header, and `accessToken` or `access_token` in the response body is stored

#### Scenario: Function refresh
- **WHEN** the session is configured with `refresh: async () => ({ accessToken: "n1" })`
- **THEN** after a refresh `session.getAccessToken()` returns `"n1"`

#### Scenario: Refresh response without a token
- **WHEN** the transport resolves without an access token
- **THEN** the refresh is treated as failed

### Requirement: Refresh failure ends the session
When a refresh fails, the session SHALL clear its tokens, reject every waiter with the refresh error, and emit `refreshFailed` exactly once for that refresh.

#### Scenario: Waiters are rejected
- **WHEN** three requests are queued behind a refresh that fails
- **THEN** all three reject with the refresh error and the stored tokens are cleared

#### Scenario: Failure event fires once
- **WHEN** a refresh awaited by five callers fails
- **THEN** `refreshFailed` listeners are called once

### Requirement: Session lifecycle events
A session SHALL emit `refreshStart`, `refreshed` (with the new access token and, for the declarative transport, the raw response), `refreshFailed` (with the error) and `cleared`. `on()` SHALL return an unsubscribe function and accept any number of listeners per event.

#### Scenario: Multiple listeners
- **WHEN** two listeners subscribe to `refreshed` and a refresh succeeds
- **THEN** both are called with the new token, after it has been stored

#### Scenario: Unsubscribe
- **WHEN** a listener's unsubscribe function has been called
- **THEN** it is not called on later events

#### Scenario: A throwing listener does not break the session
- **WHEN** a `refreshed` listener throws
- **THEN** the refresh still resolves, other listeners still run, and waiters still receive the token

#### Scenario: clear()
- **WHEN** `session.clear()` is called
- **THEN** tokens are cleared and `cleared` listeners are called

### Requirement: Auth monitor parity
Session refreshes SHALL report to the existing auth monitor (`setAuthMonitor`) with the same event types as the legacy interceptor: refresh start, request queued, refresh success, refresh error.

#### Scenario: Monitor receives session events
- **WHEN** a custom monitor is set and an attached instance triggers a successful refresh while another request waits
- **THEN** the monitor receives start, queued and success events

### Requirement: Attaching an axios instance
`createApiClient({ authSession: session })` SHALL make the instance send the session's token and, on a 401, refresh through the session and retry the original request once — with the same `authMode` rules (`public`: no token, no refresh; `optional`: token if present, no refresh) and the same no-retry-loop guarantee as the legacy interceptor.

#### Scenario: Token attached
- **WHEN** a token is stored and a default-auth request is sent through an attached instance
- **THEN** it carries `Authorization: Bearer <token>`

#### Scenario: 401 after refresh does not loop
- **WHEN** the retried request also returns 401
- **THEN** the request rejects with that 401 and no second refresh is started for it

#### Scenario: Public request
- **WHEN** a request with `authMode: "public"` is sent and returns 401
- **THEN** it has no Authorization header and no refresh is attempted

#### Scenario: Refresh goes to the session's transport, not the instance
- **WHEN** an instance with `baseURL: "https://tools.example"` attached to a session whose refresh targets `https://insights.example/auth/refresh` receives a 401
- **THEN** the refresh request goes to `https://insights.example/auth/refresh` and the retry goes to `https://tools.example`

#### Scenario: auth takes precedence over legacy options
- **WHEN** both `authSession` and `authOptions` are passed
- **THEN** the session is used, `authOptions` is ignored, and a development-only warning is logged

#### Scenario: No global storage side effect
- **WHEN** `createApiClient({ authSession: session })` is called
- **THEN** the `tokenManager` storage configuration is not changed

### Requirement: Auth-aware fetch
`session.fetch` SHALL be a drop-in `fetch` that attaches the current token and, on a 401 response, refreshes through the session and retries once when the request body can be replayed. It SHALL never throw for an HTTP status.

#### Scenario: Retry after refresh
- **WHEN** a `session.fetch` call returns 401 and the refresh succeeds
- **THEN** the request is repeated once with the new token and the second response is returned

#### Scenario: Refresh fails
- **WHEN** a `session.fetch` call returns 401 and the refresh fails
- **THEN** the original 401 response is returned and `refreshFailed` has been emitted

#### Scenario: Non-replayable body
- **WHEN** the request body is a `ReadableStream` and the response is 401
- **THEN** the session refreshes and the original 401 response is returned without a retry

#### Scenario: Custom fetch implementation
- **WHEN** a session is created with `fetch: customFetch`
- **THEN** `session.fetch` delegates to `customFetch`

### Requirement: Cross-tab refresh coordination
With `crossTab` enabled and the Web Locks API available, refreshes in different tabs of the same origin SHALL be serialised, and a tab that acquires the lock after another tab has already replaced the token SHALL adopt the stored token instead of performing its own refresh.
#### Scenario: Second tab adopts the new token
- **WHEN** tab B starts a refresh after its request failed with token `t0`, and by the time B holds the lock the store already contains `t1` written by tab A
- **THEN** B performs no refresh request, resolves with `t1`, and emits `refreshed`

#### Scenario: Web Locks unavailable
- **WHEN** `crossTab` is enabled but `navigator.locks` is undefined
- **THEN** the session falls back to in-tab single-flight without errors

#### Scenario: Disabled by default
- **WHEN** a session is created without `crossTab`
- **THEN** the Web Locks API is never called

### Requirement: Cross-tab adoption requires a shared token store
Token adoption SHALL be guaranteed only when the session's token store is shared between tabs (the default `tokenManager` with `LocalStorageTokenStorage`). With a per-tab store (in-memory or another custom `TokenStorage`) the lock SHALL still serialise refreshes, but each tab performs its own refresh. The limitation SHALL be documented on the `crossTab` option and in the README.

#### Scenario: Per-tab token store does not adopt
- **WHEN** `crossTab` is enabled with a token store that is not shared between tabs, and tab B acquires the lock after tab A has refreshed
- **THEN** B still sees its stale token, sends its own refresh request after A's has settled (never concurrently), and no error is raised by the session itself
