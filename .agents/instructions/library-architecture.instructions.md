# Library Architecture Rules — @ametie/vue-muza-use

Internal structure, layering constraints, and how to extend the library safely.

---

## Internal Layer Map

```
packages/use-api/src/
  types.ts                       ← ALL public TypeScript types and interfaces
  plugin.ts                      ← Vue plugin factory (createApi) + useApiConfig() injection
  composables/
    useApiState.ts               ← reactive state (data, loading, error, statusCode, response)
    useAbortController.ts        ← global AbortController instance for request cancellation
    useRefetchTriggers.ts        ← refetchOnFocus / refetchOnReconnect browser event wiring
  features/
    cacheManager.ts              ← in-memory TTL cache with SWR support
    tokenManager.ts              ← JWT token lifecycle (get/set/clear/expiry check)
    interceptors.ts              ← Axios request/response interceptors for token refresh
    createInstance.ts            ← Axios factory with auth defaults
    monitor.ts                   ← auth event monitoring (setAuthMonitor, AuthEventType)
  utils/
    debounce.ts                  ← cancellable debounce with DebounceCancelledError
    errorParser.ts               ← normalize Axios errors → ApiError shape
  useApi.ts                      ← core composable — orchestrates all layers above (18 KB)
  useApiBatch.ts                 ← parallel batch request composable
  useApi.helpers.ts              ← useApiGet, useApiPost, useApiPut, useApiPatch, useApiDelete
  index.ts                       ← public barrel export — the ONLY surface consumers see
```

---

## Layer Rules

### Rule 1 — `types.ts` is the single source of truth for all types

Add new options, return types, and interfaces to `types.ts` first, then implement.
Never define a public type inside a composable file.

```ts
// ✅ correct — add to types.ts first
export interface UseApiOptions<TRaw, D, TSelected> {
    // existing options...
    /** New option description. Default: false */
    myNewOption?: boolean;
}

// ❌ wrong — type defined inside useApi.ts
// no types.ts update, no discoverability for consumers
```

### Rule 2 — `useApi.ts` is the orchestrator — domain logic belongs in features/

`useApi.ts` wires together composables and features. Business logic for a domain (cache, tokens, retry)
lives in the corresponding feature module, not in `useApi.ts` itself.

```ts
// ✅ correct — useApi.ts composes
const cacheHit = readCache(cacheKey);
const state = useApiState<TSelected>(initialData);
const { abort, signal } = useAbortController();

// ❌ wrong — TTL calculation inline in useApi.ts
const isExpired = Date.now() - cachedAt > staleTime; // belongs in cacheManager.ts
```

### Rule 3 — `index.ts` is barrel-only, no logic

`index.ts` only re-exports. No initialization, no constants, no default instances.

```ts
// ✅ correct index.ts
export { useApi } from "./useApi";
export { useApiBatch } from "./useApiBatch";
export { useApiState } from "./composables/useApiState";
export { useAbortController } from "./composables/useAbortController";
export { createApi, createApiClient } from "./plugin";
export { tokenManager, invalidateCache, clearAllCache } from "./features/cacheManager";
export { setAuthMonitor, AuthEventType } from "./features/monitor";
export type { UseApiOptions, UseApiReturn, ApiError, AuthMode, CacheOptions, ApiState } from "./types";

// ❌ wrong — logic in index.ts
export const defaultOptions = { retry: false }; // belongs in useApi.ts
```

### Rule 4 — Internal composables and feature modules are NOT re-exported

`composables/useApiState.ts`, `features/cacheManager.ts`, etc. are internal.
Do not add them to `index.ts` unless they are intentionally part of the public API.

---

## How to Add a New Option to `useApi`

**Step 1 — Define in `types.ts`:**

```ts
export interface UseApiOptions<TRaw = unknown, D = unknown, TSelected = TRaw>
    extends ApiRequestConfig<D> {
    // ... existing options
    /**
     * Description of the new option.
     * Default: false
     */
    myNewOption?: boolean;
}
```

**Step 2 — If it exposes a new reactive value, add to `UseApiReturn` in `types.ts`:**

```ts
export interface UseApiReturn<TSelected, D> {
    // existing...
    /** Exposed reactive value from myNewOption */
    myNewValue: Ref<boolean>;
}
```

**Step 3 — Destructure and implement in `useApi.ts`:**

```ts
const {
    // existing...
    myNewOption = false,
    ...axiosConfig
} = options;

// implement behavior using myNewOption
```

**Step 4 — Write tests:** `src/__tests__/useApi.myNewOption.test.ts`

**Step 5 — Update `README.md`:** add to the options reference table.

---

## How to Add a New Feature Module

Feature modules go in `features/`. Each handles exactly one domain.
Export named functions — no classes, no default exports.

```ts
// features/myFeature.ts
export const MY_FEATURE_DEFAULT = 30_000;

/**
 * Do the feature thing.
 */
export function doMyFeatureThing(input: string): Result { ... }

/**
 * Reset feature state.
 */
export function resetMyFeature(): void { ... }
```

Import the feature inside `useApi.ts` or `plugin.ts`. Do not export from `index.ts` unless it is a public API.

---

## How to Add a New Internal Composable

Internal composables go in `composables/`. Each handles one reactive concern.
Always use `onScopeDispose` for cleanup (not `onUnmounted`).

```ts
// composables/useMyThing.ts
export interface UseMyThingReturn {
    value: Ref<string>;
    reset: () => void;
}

/**
 * Internal composable for X concern.
 */
export function useMyThing(): UseMyThingReturn {
    const value = ref("");
    const reset = () => { value.value = ""; };
    onScopeDispose(() => { /* cleanup if needed */ });
    return { value, reset };
}
```

---

## Semver Rules

Think about semver impact before implementing. State it explicitly in the PR.

| Change type | Version bump |
|-------------|-------------|
| New option with a default value (no behavior change for existing users) | `minor` |
| New composable exported from `index.ts` | `minor` |
| New field on `UseApiReturn` | `minor` |
| New utility exported from `index.ts` | `minor` |
| Rename or remove any exported name | `major` |
| Change `useApi` or `useApiBatch` function signature | `major` |
| Remove or rename a field on `UseApiReturn` | `major` |
| Change to `UseApiOptions` that removes or renames a field | `major` |
| Bug fix with no API change | `patch` |
| Internal refactor, no public API change | `patch` |
| Docs, tests, tooling only | no release |

When in doubt: if a consumer has to change their code after updating → `major`.

---

## `dist/` is Off-Limits

Never suggest edits to `dist/`. It is generated by `tsup`.
To see the built output, run `pnpm build` — never edit it directly.
