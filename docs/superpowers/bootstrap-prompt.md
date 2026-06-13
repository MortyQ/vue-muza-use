# Bootstrap Prompt — Claude Config for @ametie/vue-muza-use

Use this prompt to regenerate or update the Claude configuration for this project.
Paste it into a Claude Code session in the repo root.

---

## Prompt

```
I need you to set up a Claude AI configuration for this TypeScript + Vue 3 composable library.
The library is `@ametie/vue-muza-use` — a type-safe Axios wrapper for Vue 3 with JWT auth,
caching, polling, SWR, batching, and reactive request handling.

Please explore the repository structure first (package.json, src/ layout, tsconfig.json,
existing tests, build config), then create the following files:

---

### 1. `CLAUDE.md` (repo root)

Entry point that uses `@` includes to load all instruction files:

```md
# @ametie/vue-muza-use — Claude Instructions

## Instructions

@.agents/instructions/project.md
@.agents/instructions/conventions.md
@.agents/instructions/typescript.instructions.md
@.agents/instructions/library-architecture.instructions.md
@.agents/instructions/testing.instructions.md
@.agents/instructions/workflow.md

## Agent Behavior

@.agents/claude/behavior.md
```

---

### 2. `.agents/instructions/project.md`

Cover: what the library does, monorepo structure (`packages/use-api/`, `packages/playground/`),
full public API table (useApi, useApiBatch, useApiState, useAbortController, method helpers,
plugin, token/cache managers, auth monitoring, exported types), peer dependencies, key design goals
(reactive-first, TypeScript-first, feature wrapper pattern, production-ready).

---

### 3. `.agents/instructions/conventions.md`

Cover:
- File naming by category (composables, helpers, feature modules, utils, tests)
- Code style: 4-space indent, double quotes, semicolons, trailing commas
- Import order: external → internal → type-only (with `import type`)
- Function style: `function` keyword for exported composables, arrows for local callbacks
- JSDoc required on all public exports, `@example` for non-obvious behavior
- Naming conventions: `use<PascalCase>` composables, `camelCase` modules, `SCREAMING_SNAKE_CASE` constants

---

### 4. `.agents/instructions/typescript.instructions.md`

Rules (all hard constraints, each with ✅ correct / ❌ wrong code examples):

1. Strict mode always on — never disable individual strict flags
2. No `any` — use `unknown` + type guard or generics
3. `import type` for all type-only imports
4. Explicit return types on all exported functions (named interface preferred for complex returns)
5. `interface` for domain shapes, `type` for unions/utility compositions
6. Generic constraints — always constrain `<T>` when shape is known
7. `readonly` on function parameters where mutation is not intended
8. `satisfies` for validated literals over `as const`
9. No `as` assertions to bypass checks — only with construction comment
10. `MaybeRefOrGetter<T>` for reactive parameters + `toValue()` to resolve
11. `function` keyword allowed — match the file you're editing (different from app code)
12. `onScopeDispose` for composable cleanup (not `onUnmounted` — composables may run outside component scope)

---

### 5. `.agents/instructions/library-architecture.instructions.md`

Cover:
- Internal layer map with path + one-line description for each file
- Layer rules:
  - `types.ts` is single source of truth for all types (types first, then implement)
  - `useApi.ts` is the orchestrator, domain logic belongs in `features/`
  - `index.ts` is barrel-only (no logic, only re-exports)
  - Internal composables and feature modules are NOT re-exported unless explicitly public
- How to add a new option (5 steps: types.ts → UseApiReturn → useApi.ts → tests → README)
- How to add a new feature module (features/, named exports, no classes)
- How to add a new internal composable (composables/, onScopeDispose)
- Semver rules table (minor/patch/major decision for each change type)
- `dist/` is off-limits — never edit, always rebuild

---

### 6. `.agents/instructions/testing.instructions.md`

Cover:
- Stack: Vitest + happy-dom + @vue/test-utils
- Test file location: `packages/use-api/src/__tests__/` with naming conventions
- Mocking axios: `vi.spyOn(axios, "request")` — never mock the entire module
- `withSetup` helper pattern for testing composables in Vue scope
- Test structure: `describe > describe when > it should`
- Required coverage for every new feature: default / enabled / edge cases / cleanup / integration
- Running tests: watch, single-pass, scoped, coverage commands

---

### 7. `.agents/instructions/workflow.md`

Cover:
- pnpm commands: install, build, test (watch + CI), dev, playground
- Local linking scripts: `link-library.sh`, `unlink-library.sh`, `update-local.sh`
- Conventional commits table with version bump impact
- Breaking change format (`feat!:` + `BREAKING CHANGE:` body)
- Semantic Release process (never bump package.json manually)

---

### 8. `.agents/claude/behavior.md`

Cover:
- Before writing code: read architecture → determine semver → determine which layer
- Hard constraints: dist/ read-only, types first, tests always, index.ts barrel-only,
  JSDoc on public exports, no any, onScopeDispose
- New feature checklist (8 steps)
- Semver — state impact upfront with prefix: `[minor]`, `[patch]`, `[major]`
- Code quality notes
- Response style: lead with implementation, reference file:line, full set on new features

---

Use the actual codebase as the source of truth for examples — read `src/types.ts`,
`src/useApi.ts`, `src/composables/useApiState.ts` to extract real patterns.
Match the existing code style exactly (4-space indent, double quotes, semicolons).
```
