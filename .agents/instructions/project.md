# Project Overview — @ametie/vue-muza-use

Type-safe Vue 3 composable library built on Axios. Provides reactive HTTP request handling,
JWT token refresh, in-memory caching, polling, SWR, batching, and global abort control.

---

## Repository Structure

```
useApi/
├── packages/
│   ├── use-api/          # Main library — @ametie/vue-muza-use
│   │   ├── src/          # Source code
│   │   ├── dist/         # Built output — NEVER edit manually
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   ├── devtools/         # Devtools panel — @ametie/vue-muza-devtools (published separately)
│   └── playground/       # Dev/test sandbox — not published
├── pnpm-workspace.yaml
└── CLAUDE.md
```

---

## Public API

### Core composables

| Export | Description |
|--------|-------------|
| `useApi<T, D, TSelected>(url, options)` | Primary composable — reactive, typed, featureful HTTP requests |
| `useApiBatch<T>(requests, options)` | Parallel batch request execution with per-request state |
| `useApiState<T>()` | Standalone reactive state without HTTP (useful for manual control) |
| `useAbortController()` | Global cancellation of all in-flight requests |

### Method helpers (thin wrappers over `useApi`)

`useApiGet` · `useApiPost` · `useApiPut` · `useApiPatch` · `useApiDelete`

### Plugin & configuration

| Export | Description |
|--------|-------------|
| `createApi(options)` | Vue plugin factory — installs the library into a Vue app |
| `createApiClient(options)` | Pre-configured Axios instance with JWT auth + interceptors |
| `useApiConfig()` | Internal — reads config injected by the plugin |

### Token & cache management

| Export | Description |
|--------|-------------|
| `tokenManager` | JWT token lifecycle: get/set/clear/check expiry |
| `invalidateCache(id \| id[])` | Imperatively bust specific cache entries |
| `clearAllCache()` | Wipe the entire in-memory cache |

### Auth monitoring

| Export | Description |
|--------|-------------|
| `setAuthMonitor(fn)` | Listen to auth lifecycle events (token refresh, logout, etc.) |
| `AuthEventType` | Enum of all auth event types |

### Key types

`ApiError` · `AuthMode` · `CacheOptions` · `ApiState` · `ApiRequestConfig` · `UseApiOptions` · `UseApiBatchOptions` · `UseApiReturn`

---

## Peer Dependencies

- `vue` ^3.5
- `axios` ^1.0

---

## Key Design Goals

- **Reactive-first** — deps in `url`, `data`, `params` are tracked automatically; no explicit `watch` needed
- **TypeScript-first** — strict mode, zero `any`, every public API fully typed with generics
- **Feature wrapper pattern** — consumers wrap `useApi*` calls in feature composables; never call them directly from components
- **Production-ready** — race condition protection, request queuing on 401, retry, SWR, polling, memory-safe cleanup
