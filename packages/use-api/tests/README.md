# Tests — `@ametie/vue-muza-use`

Tests live here, outside `src/`, so the source tree shows only shipped code.
The layout **mirrors `src/`** — a test sits at the same relative path as its subject:

| Subject | Test |
|---------|------|
| `src/useApi.ts` | `tests/useApi.test.ts`, `tests/useApi.<feature>.test.ts` |
| `src/useApiBatch.ts` | `tests/useApiBatch.test.ts`, `tests/useApiBatch.<feature>.test.ts` |
| `src/composables/useApiState.ts` | `tests/composables/useApiState.test.ts` |
| `src/features/tokenManager.ts` | `tests/features/tokenManager.test.ts` |
| `src/utils/time.ts` | `tests/utils/time.test.ts` |
| cross-cutting / multi-module | `tests/integration/<topic>.test.ts` |

`tests/__mocks__/@ametie/vue-muza-devtools.ts` stubs the optional devtools peer,
which is not installed in the test environment. `vitest.config.ts` aliases the
package name to it so Vite can resolve it at transform time.

Imports reach the source through a relative path — `../src/useApi`,
`../../src/features/cacheManager`. There is no path alias on purpose: the depth
makes it obvious when a test file sits in the wrong folder.

## Running

```bash
# from repo root — watch mode
pnpm test

# single pass (CI) — NOTE: `test --run` silently swallows --run via pnpm
pnpm --filter @ametie/vue-muza-use exec vitest run

# one file
pnpm --filter @ametie/vue-muza-use exec vitest run tests/useApiBatch.race.test.ts

# coverage
pnpm --filter @ametie/vue-muza-use exec vitest run --coverage
```

Conventions for writing tests (mocking axios, the `withSetup` pattern, what every
new feature must cover) live in `.agents/instructions/testing.instructions.md`.
