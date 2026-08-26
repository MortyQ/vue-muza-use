# Testing Rules — @ametie/vue-muza-use

Every new feature, option, or composable must ship with tests. No exceptions.

---

## Rule 0 — Existing Suite First, New Tests Second

After **any** source change, run the full existing suite **before** writing a single new test:

```bash
pnpm --filter @ametie/vue-muza-use exec vitest run
```

Order is mandatory, not a preference:

1. **Change the source.**
2. **Run the existing suite.** It must be green. A failure here is a regression in behavior
   consumers already depend on — fix it before going any further. Never adjust an existing
   assertion to accommodate the new code unless the change is intentionally breaking, and say
   so explicitly with the semver impact.
3. **Only then write the new tests** for the new behavior (see the five categories below).
4. **Run the full suite again** — new tests plus old ones in one pass.
5. **`pnpm build`** — the public `.d.ts` must reflect any type change.

Why: new tests written first are written against code that has not been proven to leave the
rest of the library intact. Green-new-tests over a red suite reads as success and is not.
Report the actual numbers from step 4 (files / passed / todo), never a summary from memory.

---

## Stack

- **Vitest** — test runner + assertions
- **happy-dom** — lightweight DOM environment
- **@vue/test-utils** — Vue composable testing (`mount`, `flushPromises`)

---

## Test File Location and Naming

All tests live in `packages/use-api/tests/`, **outside `src/`** — the source tree
holds only shipped code. The layout mirrors `src/`: a test sits at the same
relative path as its subject. For a new feature: `tests/useApi.<feature>.test.ts`.

| Subject | Test file |
|---------|-----------|
| Core `useApi` behavior | `tests/useApi.core.test.ts` |
| Feature-specific behavior | `tests/useApi.<feature>.test.ts` |
| `useApiBatch` behavior | `tests/useApiBatch.<feature>.test.ts` |
| Internal composable | `tests/composables/<composable>.test.ts` (mirrors `src/composables/`) |
| Feature module | `tests/features/<module>.test.ts` (mirrors `src/features/`) |
| Utility | `tests/utils/<util>.test.ts` (mirrors `src/utils/`) |
| Helpers | `tests/useApi.helpers.test.ts` |
| Cross-cutting integration | `tests/integration/<topic>.test.ts` |

Import the subject through a relative path into `src` — `../src/useApi`,
`../../src/features/cacheManager`. No path alias, on purpose: the depth makes a
misplaced file obvious. See `packages/use-api/tests/README.md`.

Create a new file for a new feature (`useApi.myNewOption.test.ts`) rather than appending to an existing file.

---

## Mocking Axios

Use `vi.spyOn` on the axios instance. Never mock the entire `axios` module.

```ts
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";

let axiosSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    axiosSpy = vi.spyOn(axios, "request").mockResolvedValue({
        data: { id: 1, name: "Test" },
        status: 200,
        headers: {},
        config: {} as never,
        statusText: "OK",
    });
});

afterEach(() => {
    vi.clearAllMocks();
});
```

---

## Testing Composables — `withSetup` Pattern

Composables must be tested inside a Vue scope. Use `withSetup` to mount a minimal component:

```ts
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";

function withSetup<T>(composable: () => T): [T, ReturnType<typeof mount>] {
    let result!: T;
    const wrapper = mount(defineComponent({
        setup() {
            result = composable();
            return () => null;
        },
    }));
    return [result, wrapper];
}

// Usage
it("should resolve data and set loading to false", async () => {
    const [{ loading, data }] = withSetup(() =>
        useApi("/users", { immediate: true })
    );

    expect(loading.value).toBe(true);
    await flushPromises();
    expect(loading.value).toBe(false);
    expect(data.value).toEqual({ id: 1, name: "Test" });
});

// Cleanup test — unmount and assert no lingering side effects
it("should abort on unmount", async () => {
    const [{ loading }, wrapper] = withSetup(() =>
        useApi("/users", { immediate: true })
    );
    wrapper.unmount();
    await flushPromises();
    expect(axiosSpy).toHaveBeenCalledTimes(1);
    // no further calls after unmount
});
```

---

## Test Structure

```ts
describe("useApi — <feature name>", () => {
    beforeEach(() => {
        // setup axios mock, reset state
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("when <condition>", () => {
        it("should <expected behavior>", async () => {
            // arrange
            // act
            // assert
        });
    });
});
```

---

## What Every New Feature Must Cover

When adding a new option or behavior to `useApi`, write tests for all five:

| Category | What to verify |
|----------|----------------|
| **Default** | Option absent → existing behavior is unchanged |
| **Enabled** | Option active → new behavior works correctly |
| **Edge cases** | `null`/`undefined` input, rapid re-triggers, concurrent calls |
| **Cleanup** | No leaks after `wrapper.unmount()` |
| **Integration** | New option + existing option (e.g. new option + `cache`, new option + `retry`) |

---

## Running Tests

```bash
# from repo root — watch mode
pnpm test

# single pass (CI) — NOTE: `test --run` silently swallows --run via pnpm;
# use exec vitest run instead
pnpm --filter @ametie/vue-muza-use exec vitest run

# single pass, one file
pnpm --filter @ametie/vue-muza-use exec vitest run tests/useApi.swr.test.ts

# watch a specific file
pnpm --filter @ametie/vue-muza-use exec vitest tests/useApi.swr.test.ts

# coverage report
pnpm --filter @ametie/vue-muza-use exec vitest run --coverage
```
