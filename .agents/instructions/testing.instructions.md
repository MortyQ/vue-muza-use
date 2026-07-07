# Testing Rules — @ametie/vue-muza-use

Every new feature, option, or composable must ship with tests. No exceptions.

---

## Stack

- **Vitest** — test runner + assertions
- **happy-dom** — lightweight DOM environment
- **@vue/test-utils** — Vue composable testing (`mount`, `flushPromises`)

---

## Test File Location and Naming

Tests are co-located with their subject (`<file>.test.ts` next to the source file);
cross-cutting integration tests live in `packages/use-api/src/__tests__/`.
For a new feature, prefer co-location: `src/useApi.<feature>.test.ts`.

| Subject | File naming |
|---------|-------------|
| Core `useApi` behavior | `useApi.core.test.ts` |
| Feature-specific behavior | `useApi.<feature>.test.ts` |
| Internal composable | `<composable>.test.ts` (next to the composable, e.g. `composables/useAbortController.test.ts`) |
| Feature module | `<module>.test.ts` (next to the module, e.g. `features/tokenManager.test.ts`) |
| Helpers | `useApi.helpers.test.ts` |
| Cross-cutting integration | `__tests__/<topic>.test.ts` |

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
pnpm --filter @ametie/vue-muza-use exec vitest run src/useApi.swr.test.ts

# watch a specific file
pnpm --filter @ametie/vue-muza-use exec vitest src/useApi.swr.test.ts

# coverage report
pnpm --filter @ametie/vue-muza-use exec vitest run --coverage
```
