# Conventions — @ametie/vue-muza-use

Naming, file structure, and code style rules.

---

## File Naming

| What | Convention | Examples |
|------|-----------|---------|
| Core composables | `use<Name>.ts` | `useApi.ts`, `useApiBatch.ts` |
| Method helpers | `<composable>.helpers.ts` | `useApi.helpers.ts` |
| Internal composables | `use<Name>.ts` | `useApiState.ts`, `useAbortController.ts` |
| Feature modules | `camelCase.ts` | `cacheManager.ts`, `tokenManager.ts` |
| Utilities | `camelCase.ts` | `debounce.ts`, `errorParser.ts` |
| Test files | `<subject>.test.ts` | `useApi.core.test.ts`, `cacheManager.test.ts` |

---

## Code Style

| Rule | Value |
|------|-------|
| Indent | 4 spaces |
| Quotes | Double (`"`) |
| Semicolons | Required |
| Trailing commas | `always-multiline` |

Match the style of the file you are editing. Prefer 4-space indent for new files.

---

## Import Order

1. External packages (`vue`, `axios`)
2. Internal relative imports (`./`, `../`)
3. Type-only imports grouped with `import type`

```ts
// ✅ correct
import { ref, computed, watch, toValue, type MaybeRefOrGetter } from "vue";
import { type AxiosRequestConfig, isAxiosError } from "axios";

import type { UseApiOptions, UseApiReturn, ApiError } from "./types";
import { useApiState } from "./composables/useApiState";
import { parseApiError } from "./utils/errorParser";
```

Always use `import type` for type-only imports.

---

## Function Style

The `function` keyword is used throughout the codebase for composables and module-level functions.
Arrow functions are appropriate for local callbacks and method assignments inside a function body.

```ts
// ✅ correct — exported composable uses function keyword
export function useApiState<T = unknown>(initialData: T | null = null): UseApiStateReturn<T> {
    // ...
}

// ✅ correct — local method uses arrow
const mutate = (newData: SetDataInput<T>) => {
    data.value = newData;
};

// ✅ both styles coexist naturally — match the surrounding code
```

---

## JSDoc — Required on Public Exports

Every exported function, interface, and type must have a JSDoc comment.
Internal functions that are not exported do not require JSDoc.
Include `@example` for non-obvious behavior.

```ts
// ✅ correct — public export with JSDoc + example
/**
 * Composable for standalone reactive API state management without HTTP.
 *
 * @example
 * ```ts
 * const { data, loading, error, mutate } = useApiState<User[]>();
 * mutate(newUsers);
 * ```
 */
export function useApiState<T = unknown>(...): UseApiStateReturn<T> { ... }

// ✅ correct — internal helper without JSDoc
function normalizeCacheOptions(cache: string | CacheOptions | undefined) { ... }

// ❌ wrong — public export missing JSDoc
export function useAbortController(): UseAbortControllerReturn { ... }
```

---

## Naming

| What | Convention | Examples |
|------|-----------|---------|
| Exported composables | `use<PascalCase>` | `useApi`, `useApiBatch`, `useApiState` |
| Internal composables | `use<PascalCase>` | `useApiState`, `useAbortController` |
| Feature modules | `<camelCase>Manager` / `<domain>s` | `cacheManager`, `tokenManager`, `interceptors` |
| Public types/interfaces | `PascalCase` | `UseApiOptions`, `ApiError`, `CacheOptions` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_STALE_TIME`, `DEFAULT_RETRY_STATUS_CODES` |
