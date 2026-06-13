# Claude Behavior — @ametie/vue-muza-use

---

## Before Writing Any Code

1. Read `library-architecture.instructions.md` — determine which layer the change belongs to
   (`types.ts`, `composables/`, `features/`, `useApi.ts`).
2. For TypeScript questions: read `typescript.instructions.md`.
3. For new features: determine the semver impact (patch / minor / major) using the table in
   `library-architecture.instructions.md` and state it explicitly before proposing an approach.
4. For test-related work: read `testing.instructions.md`.

---

## Hard Constraints

- **`dist/` is read-only** — never suggest edits to `dist/`. Regenerate with `pnpm build`.
- **Types first** — any new option or return value must be defined in `types.ts` before being implemented.
- **Tests alongside features** — every new option, composable, or feature module requires tests.
  Shipping without tests is not acceptable.
- **`index.ts` is barrel-only** — no logic, no constants, only re-exports.
- **JSDoc on every public export** — no exception. Include `@example` when behavior is non-obvious.
- **No `any`** — use `unknown` + type guard or proper generics.
- **`onScopeDispose` for cleanup** — not `onUnmounted` inside composables.

---

## New Feature Checklist

Before proposing an implementation for a new feature:

1. New types / interfaces → `types.ts` first
2. New feature module (domain logic) → `features/<name>.ts`
3. New internal composable (reactive concern) → `composables/<name>.ts`
4. Changes to `useApi.ts` → list which options are added or changed
5. New public export → update `index.ts`
6. Tests → `src/__tests__/useApi.<feature>.test.ts` (default, enabled, edge cases, cleanup, integration)
7. Docs → update README.md options table

---

## Semver — State It Upfront

At the start of any feature proposal, state the semver impact:

```
[minor] Add `retryOnMount` option to useApi — new option with default false, additive change.
[major] Rename UseApiReturn.execute → UseApiReturn.run — breaking: all consumers must update.
[patch] Fix memory leak in useApiBatch when component unmounts during a request.
```

If the change is `major`, flag it clearly and suggest a deprecation path if possible.

---

## Code Quality

- Match the indent and quote style of the file being edited (4-space, double quotes is the dominant style).
- `function` keyword for exported composables; arrow functions for local callbacks — match surrounding code.
- `import type` for every type-only import.
- Keep `useApi.ts` as the orchestrator — domain logic belongs in `features/`, not inlined.
- Use `onScopeDispose` for cleanup inside composables.

---

## Response Style

- Lead with the implementation — skip preamble.
- Reference file paths with line numbers when pointing to code: `packages/use-api/src/useApi.ts:47`.
- State semver impact at the start of any feature proposal.
- When creating a new feature, always produce the full set: `types.ts` → implementation → tests.
- If README update is needed, say so explicitly and include the diff.
