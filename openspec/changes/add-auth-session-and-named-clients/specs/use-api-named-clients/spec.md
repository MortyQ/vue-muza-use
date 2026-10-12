# Spec Delta

## Purpose

Lets one app talk to several backends through `useApi` by registering extra axios instances under
names and choosing one per request, without cache collisions between backends and without changing
anything for requests that do not name a client.

## ADDED Requirements

### Requirement: Default client is unchanged
A request that does not set `client` SHALL be sent through the `axios` instance given to `createApi`, with the same cache key, error parsing, error notification and devtools reporting as in 1.8.x.

#### Scenario: Request without client
- **WHEN** `useApi("/users", { immediate: true })` runs in an app configured with `createApi({ axios: main, clients: { tools } })`
- **THEN** the request goes through `main`

#### Scenario: Default cache key format unchanged
- **WHEN** a cached `GET /users` with params `{ page: 1 }` is made without `client`
- **THEN** its cache key is `auto:GET:/users:{"page":1}:` exactly as produced by 1.8.x

#### Scenario: Explicit default
- **WHEN** a request sets `client: "default"`
- **THEN** it behaves exactly like a request without `client`, including its cache key

### Requirement: Registering named clients
`createApi` SHALL accept `clients`, a map from name to either an axios instance or `{ axios, errorParser? }`. The name `default` is reserved for the main `axios`.

#### Scenario: Shorthand and full form
- **WHEN** `createApi({ axios: main, clients: { tools: toolsAxios, mcp: { axios: mcpAxios, errorParser } } })` is installed
- **THEN** both `tools` and `mcp` are selectable by name

#### Scenario: Reserved name
- **WHEN** `clients` contains a key `default`
- **THEN** `createApi` throws an error naming the reserved key

### Requirement: Selecting a client per request
`useApi` and every method helper SHALL accept a static `client` option naming a registered client; the request, its retries and any 401-refresh retry go through that client's axios instance. `client` SHALL NOT be forwarded to axios.

#### Scenario: Named client request
- **WHEN** `useApiGet("/brands", { client: "tools", immediate: true })` runs
- **THEN** the request goes through the `tools` instance with a relative URL resolved against that instance's `baseURL`

#### Scenario: client is not an axios option
- **WHEN** a request with `client: "tools"` is sent
- **THEN** the config passed to axios has no `client` key

#### Scenario: Unknown client
- **WHEN** `useApi("/x", { client: "nope" })` is called and no client `nope` is registered
- **THEN** it throws an error that names `nope` and lists the registered client names

### Requirement: Client names are type-checked when declared
The library SHALL export an empty, augmentable `ApiClientRegistry` interface. When an app augments it, the `client` option SHALL accept only `"default"` and the declared names; when it is not augmented, any string SHALL be accepted.

#### Scenario: Augmented registry rejects a typo
- **WHEN** an app declares `interface ApiClientRegistry { tools: true }` and writes `client: "tool"`
- **THEN** type-checking fails

#### Scenario: No augmentation
- **WHEN** the registry is not augmented
- **THEN** `client: "anything"` type-checks

### Requirement: Cache keys are scoped by client
Auto-generated cache keys for a named client SHALL be prefixed with `auto@<client>:` so they can never equal a default-client key or another client's key. Manual cache ids (`cache: { id }`) SHALL be used verbatim for every client.

#### Scenario: Same path on two backends
- **WHEN** `GET /brands` is cached once without `client` and once with `client: "tools"`
- **THEN** two separate cache entries exist and neither request is served the other's data

#### Scenario: Prefix invalidation per client
- **WHEN** `invalidateCache({ prefix: "auto@tools:GET:/brands" })` is called
- **THEN** only the `tools` entries for that path are removed

#### Scenario: Manual id
- **WHEN** a named-client request uses `cache: { id: "brands" }`
- **THEN** its cache key is `brands`

### Requirement: Batch requests support clients
`useApiBatch` SHALL accept `client` at batch level and per request item; an item's `client` overrides the batch's. Cache reads made by the batch SHALL use the same client-scoped key the item's request writes.

#### Scenario: Mixed batch
- **WHEN** a batch with `client: "tools"` contains one item without `client` and one with `client: "default"`
- **THEN** the first goes through `tools` and the second through the default instance

#### Scenario: Batch cache hit on a named client
- **WHEN** a cached batch item with `client: "tools"` is executed a second time within its fresh window
- **THEN** it is served from the `tools`-scoped cache entry without a request

### Requirement: Per-client error parsing and error context
A request's error SHALL be parsed by its client's `errorParser` when one is registered, otherwise by the global `errorParser`, otherwise by the built-in parser. For a named-client request the global `onError` SHALL receive a third argument `{ client }` naming that client; a default-client request SHALL call it with exactly the two arguments of 1.8.x.

#### Scenario: Client parser wins
- **WHEN** the `tools` client has its own `errorParser` and a `tools` request fails
- **THEN** `error.value` is the result of the `tools` parser

#### Scenario: Fallback to global parser
- **WHEN** a named client without its own parser fails
- **THEN** the global `errorParser` is used

#### Scenario: onError context
- **WHEN** a `tools` request fails and error notification is not skipped
- **THEN** the global `onError` is called with `(apiError, originalError, { client: "tools" })`

#### Scenario: Default-client onError arguments unchanged
- **WHEN** a request without `client` (or with `client: "default"`) fails and error notification is not skipped
- **THEN** the global `onError` is called with exactly `(apiError, originalError)`, as in 1.8.x

### Requirement: Global behaviour applies to every client
Global abort, global cache defaults, global retry options and devtools reporting SHALL apply to named-client requests exactly as to default-client requests.

#### Scenario: Global abort
- **WHEN** the global abort controller aborts while a `tools` request is in flight
- **THEN** that request is cancelled

#### Scenario: Global cache defaults
- **WHEN** `createApi` is configured with `globalOptions.cacheDefaults: { staleTime: 60_000 }` and a `tools` request uses `cache: true`
- **THEN** the entry is stored under its `auto@tools:` key with a 60 000 ms stale time, exactly as a default-client entry would be

#### Scenario: Global retry options
- **WHEN** `createApi` is configured with `globalOptions: { retry: 2, retryDelay: 0 }` and a `tools` request fails three times with 503
- **THEN** the request is attempted three times in total, every attempt goes through the `tools` instance, and the final error is reported

#### Scenario: Devtools reporting
- **WHEN** devtools is enabled and a `tools` request completes
- **THEN** the devtools bridge receives the same request-start and request-end events, with the same record fields, as for a default-client request, and the reported cache key is the `auto@tools:` key
