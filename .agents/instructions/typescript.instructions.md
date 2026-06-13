# TypeScript Rules — @ametie/vue-muza-use

Hard constraints. Strict mode is always on. This is a library — consumers depend on the
types being correct, complete, and stable. Every rule here is verifiable in code review.

---

## Rule 1 — Strict Mode Always On

`tsconfig.json` must have `"strict": true`. Never disable it, never override individual strict flags.

---

## Rule 2 — No `any`

`any` is banned. Use `unknown` with a type guard for truly unknown data, or proper generics.

```ts
// ✅ correct — unknown + type guard
function parseApiError(error: unknown): ApiError {
    if (!isAxiosError(error)) return { message: String(error), status: 0 };
    return { message: error.message, status: error.response?.status ?? 0 };
}

// ❌ wrong — any to silence TS
function handleResponse(data: any) { ... }

// ❌ wrong — cast to any to bypass check
const id = (response as any).data.id;
```

---

## Rule 3 — `import type` for Type-Only Imports

All type-only imports must use `import type`. Prevents runtime import issues and makes
the library tree-shake correctly for consumers.

```ts
// ✅ correct
import type { UseApiOptions, UseApiReturn, ApiError } from "./types";
import type { MaybeRefOrGetter, Ref, ComputedRef } from "vue";

// ❌ wrong
import { UseApiOptions } from "./types";
import { Ref } from "vue";
```

---

## Rule 4 — Explicit Return Types on All Exported Functions

Every exported composable and utility function must declare its return type explicitly.
TypeScript inference is not a substitute for a documented public contract that consumers rely on.

```ts
// ✅ correct — named interface (preferred for complex returns)
export interface UseApiStateReturn<T = unknown> {
    data: Ref<T | null>;
    loading: Ref<boolean>;
    error: Ref<ApiError | null>;
    mutate: (newData: SetDataInput<T>) => void;
    reset: () => void;
}

export function useApiState<T = unknown>(
    initialData: T | null = null,
): UseApiStateReturn<T> { ... }

// ✅ correct — inline for simple utilities
export function invalidateCache(id: string | string[]): void { ... }

// ❌ wrong — no return type on exported composable
export function useApiState<T = unknown>(initialData: T | null = null) { ... }
```

---

## Rule 5 — `interface` vs `type`

Use `interface` for domain shapes that may be extended or implemented.
Use `type` for unions, intersections, utility compositions, and aliases.

```ts
// ✅ correct — interface for public shapes
export interface UseApiOptions<TRaw, D, TSelected> { ... }
export interface ApiError { message: string; status: number; }
export interface CacheOptions { id: string; staleTime?: number; }

// ✅ correct — type for unions and aliases
export type AuthMode = "default" | "public" | "optional";
export type SetDataInput<T> = T | null | ((prev: T | null) => T | null);
```

---

## Rule 6 — Generic Constraints

Always constrain generic type parameters when the shape is known.
Unconstrained `<T>` where a shape can be specified is banned.

```ts
// ✅ correct
function getFromCache<T extends object>(id: string): T | null { ... }

// ✅ correct — T = unknown is acceptable as a default for open-ended data types
export function useApi<T = unknown, D = unknown, TSelected = T>(...) { ... }

// ❌ wrong — unconstrained when constraint is possible
function getFromCache<T>(id: string): T | null { ... }
```

---

## Rule 7 — `readonly` on Function Parameters

Mark array and object parameters as `readonly` where mutation is not intended.
This prevents accidental internal mutation of consumer-provided values.

```ts
// ✅ correct
export function useApiBatch<T>(
    requests: ReadonlyArray<BatchRequest<T>>,
    options: Readonly<UseApiBatchOptions<T>> = {},
): UseApiBatchReturn<T> { ... }

// ❌ wrong — mutable array param allows push/splice
export function useApiBatch<T>(requests: BatchRequest<T>[], ...): UseApiBatchReturn<T> { ... }
```

---

## Rule 8 — `satisfies` for Validated Literals

Use `satisfies` when type validation is needed without widening the inferred type.

```ts
// ✅ correct — shape is verified, literals preserved
const DEFAULTS = {
    method: "GET",
    immediate: false,
    retry: false,
    retryDelay: 1000,
} satisfies Partial<UseApiOptions<unknown>>;

// ❌ wrong — as const alone: no shape validation
const DEFAULTS = {
    method: "GET",
    unknownField: true, // TS silent — not validated
} as const;
```

---

## Rule 9 — No `as` Type Assertions to Bypass Checks

`as` is banned for silencing TypeScript. Allowed only when the type is known by construction,
with a comment explaining why.

```ts
// ✅ correct — construction is explicit, comment explains why
const data = ref<T | null>(initialData) as Ref<T | null>;
// TypeScript widens ref<T | null> inference — explicit cast is safe here

// ❌ wrong — as to bypass a missing type
const result = response as ApiResponse;

// ❌ wrong — as to access unknown property
const id = (row as any).id;
```

---

## Rule 10 — `MaybeRefOrGetter<T>` for Reactive Parameters

Composables that receive external values must accept `MaybeRefOrGetter<T>` and resolve
them with `toValue()`. This makes the composable work with raw values, refs, and getter functions.

```ts
// ✅ correct
import { toValue, type MaybeRefOrGetter } from "vue";

export function useApi<T>(
    url: MaybeRefOrGetter<string | undefined>,
    options: UseApiOptions<T> = {},
): UseApiReturn<T> {
    watch(() => toValue(url), (newUrl) => { ... });
}

// All of these work for consumers:
useApi("/users")
useApi(ref("/users"))
useApi(() => `/users/${id.value}`)

// ❌ wrong — only accepts raw string, reactive URLs break
export function useApi<T>(url: string, ...): UseApiReturn<T> { ... }
```

---

## Rule 11 — `function` Keyword Allowed

Unlike application code that may enforce arrow-only, this library uses the `function` keyword
for exported composables and module-level utilities throughout the codebase. Both styles are valid
here — match the file you are editing.

```ts
// ✅ correct — function keyword for composable
export function useApiState<T>(initialData: T | null = null): UseApiStateReturn<T> { ... }

// ✅ correct — arrow for local helper
const normalize = (input: string): string => input.trim().toLowerCase();

// ✅ both styles coexist — follow the surrounding code
```

---

## Rule 12 — `onScopeDispose` for Composable Cleanup

Internal composables must use `onScopeDispose` for cleanup, not `onUnmounted`.
Composables may be called outside a component's lifecycle (e.g., in Pinia stores, plain functions).

```ts
// ✅ correct
import { onScopeDispose } from "vue";

export function useMyThing(): UseMyThingReturn {
    const controller = new AbortController();
    onScopeDispose(() => controller.abort());
    return { ... };
}

// ❌ wrong — breaks when used outside a component
import { onUnmounted } from "vue";
export function useMyThing() {
    onUnmounted(() => cleanup()); // warning: no current instance
}
```
