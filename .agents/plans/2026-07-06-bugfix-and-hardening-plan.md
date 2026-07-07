# Bugfix & Hardening Implementation Plan — @ametie/vue-muza-use

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all confirmed defects from `.agents/analysis/deep-analysis-2026-07-06.md` (P0), sync docs/skill with reality (P1), and provide design briefs for P2 features.

**Architecture:** Phase 1 = nine independent `fix`/`refactor` commits, each TDD'd, no public API breaks. Phase 2 = documentation-only commits (no release). Phase 3 = design briefs for `minor` features — each needs its own brainstorm + detailed plan before execution. Phase 4 = v2 breaking changes, deliberately deferred.

**Tech Stack:** Vue 3.5 composables, Axios 1.x, TypeScript strict, Vitest + happy-dom + @vue/test-utils, tsup, pnpm workspace.

---

## ⚠️ Project ground rules (read before ANY task)

1. **Git:** NEVER commit or push without explicit written confirmation from the user (project memory: `feedback_git_workflow.md`). Commit steps below are *prepared*, but the executor must show the user the staged diff summary and ask before each commit (or batch-confirm a series).
2. **Conventional commits** drive Semantic Release: `fix:` = patch, `feat:` = minor, `docs:/test:/refactor:/chore:` = no release. Never bump `package.json` version manually.
3. **Run tests with:** `pnpm --filter @ametie/vue-muza-use exec vitest run` (single pass) or append a file filter: `pnpm --filter @ametie/vue-muza-use exec vitest run src/useApi.core.test.ts`. The command in workflow.md (`test --run`) does NOT work — pnpm swallows `--run` (Phase 2 fixes the doc).
4. **Code style:** 4-space indent, double quotes, semicolons — *except* match the local style of the block you edit (some sections are semicolon-less; do not reformat surrounding code).
5. **`dist/` is generated — never edit.** Types go to `types.ts` first. JSDoc on every public export. No `any` (use `unknown` + guards).
6. SPA-only is intentional — do not add SSR handling beyond existing `typeof document/window` guards.
7. After each task: run the FULL suite, not just the new tests (baseline: 467 passed / 22 todo).

---

# Phase 1 — P0 correctness & leak fixes (all patch releases)

Tasks 1–9 are independent. Recommended order below minimizes merge friction (types first where shared).

---

### Task 1: Per-call `ExecuteConfig` — stop leaking useApi-only keys into axios + tighten type

**Why:** `executeRequest` spreads raw `...config` into `axios.request()`, so per-call `cache`, `retry`, callbacks etc. land in the axios config (visible in `response.config`, interceptors, devtools). Also `ExecuteConfig` advertises `select` which is silently ignored, and `execute` return type contains an impossible `undefined`.

**Files:**
- Modify: `packages/use-api/src/types.ts` (ExecuteConfig Omit list ~line 207; UseApiReturn.execute ~line 232)
- Modify: `packages/use-api/src/useApi.ts` (~lines 264–275)
- Test: `packages/use-api/src/__tests__/useApi.executeConfig.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing tests**

Append to the existing top-level `describe` in `src/__tests__/useApi.executeConfig.test.ts` (reuse the file's existing mock/mount helpers — read the file first and match its setup):

```ts
describe("execute(config) — axios config hygiene", () => {
    it("does not forward useApi-only options to axios.request", async () => {
        mockSuccess({ ok: true });
        const [{ execute }] = withSetup(() => useApi("/items", { lazy: true }));

        await execute({
            cache: "hygiene-key",
            invalidateCache: "other-key",
            retry: 2,
            retryDelay: 5,
            retryStatusCodes: [500],
            skipErrorNotification: true,
            onBefore: () => {},
            onSuccess: () => {},
            onError: () => {},
            onFinish: () => {},
        });

        const axiosArg = requestSpy.mock.calls[0][0];
        for (const key of [
            "cache", "invalidateCache", "retry", "retryDelay", "retryStatusCodes",
            "skipErrorNotification", "onBefore", "onSuccess", "onError", "onFinish",
        ]) {
            expect(axiosArg).not.toHaveProperty(key);
        }
    });

    it("still forwards genuine axios keys per call (headers, method, responseType)", async () => {
        mockSuccess({ ok: true });
        const [{ execute }] = withSetup(() => useApi("/items", { lazy: true }));

        await execute({
            method: "POST",
            headers: { "X-Test": "1" },
            responseType: "blob",
        });

        const axiosArg = requestSpy.mock.calls[0][0];
        expect(axiosArg.method).toBe("POST");
        expect(axiosArg.headers).toEqual({ "X-Test": "1" });
        expect(axiosArg.responseType).toBe("blob");
    });
});
```

Adapt helper names (`mockSuccess`, `requestSpy`, `withSetup`) to whatever the existing file actually uses. Add `clearAllCache()` to the file's `beforeEach` if not present (the first test writes cache key `hygiene-key`).

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/__tests__/useApi.executeConfig.test.ts`
Expected: FAIL — `axiosArg` HAS property `cache` (etc.). Second test should already pass.

- [ ] **Step 3: Tighten `ExecuteConfig` and `execute` return type in `types.ts`**

In the `ExecuteConfig` Omit list, add `"select"` (it was never honored at runtime — removing it from the type surfaces the truth):

```ts
export type ExecuteConfig<D = unknown> = Omit<
    UseApiOptions<unknown, D, unknown>,
    | "immediate"
    | "initialData"
    | "initialLoading"
    | "debounce"
    | "useGlobalAbort"
    | "lazy"
    | "refetchOnFocus"
    | "refetchOnReconnect"
    | "poll"
    | "select"
>;
```

In `UseApiReturn`, fix the return type (implementation can only produce `T | null`):

```ts
    execute: (config?: ExecuteConfig<D>) => Promise<T | null>;
```

- [ ] **Step 4: Filter the per-call config in `useApi.ts`**

In `executeRequest`, immediately after the `effectiveMaxRetries` block (~line 168), add:

```ts
        // Per-call config must get the same filtering as setup-time options:
        // useApi-only keys must never reach axios.request()
        const {
            cache: _cfgCache,
            invalidateCache: _cfgInvalidateCache,
            retry: _cfgRetry,
            retryDelay: _cfgRetryDelay,
            retryStatusCodes: _cfgRetryStatusCodes,
            skipErrorNotification: _cfgSkip,
            onBefore: _cfgOnBefore,
            onSuccess: _cfgOnSuccess,
            onError: _cfgOnError,
            onFinish: _cfgOnFinish,
            authMode: _cfgAuthMode,
            data: _cfgData,
            params: _cfgParams,
            ...configAxios
        } = config ?? {};
```

Then change the axios call (~line 266) to spread the filtered object instead of raw `config`:

```ts
                    const response = await axios.request<T>({
                        url: requestUrl,
                        method,
                        ...axiosConfig,
                        ...configAxios,
                        data: resolvedData,
                        params: resolvedParams,
                        signal: controller.signal,
                        ...({ authMode: config?.authMode || authMode } as unknown as AxiosRequestConfig),
                    } as AxiosRequestConfig);
```

Note: `data`/`params`/`authMode` are destructured out but still handled explicitly via `resolvedData`/`resolvedParams`/the `authMode` spread — behavior unchanged. `method`, `headers`, `responseType`, `signal` (batch) remain in `configAxios` — intended.

- [ ] **Step 5: Run the target file, then the full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/__tests__/useApi.executeConfig.test.ts`
Expected: PASS.
Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: 469+ passed, 0 failed. If any test passed `select` inside `execute()`, it was dead code — update that test.

- [ ] **Step 6: Commit (after user confirmation)**

```bash
git add packages/use-api/src/types.ts packages/use-api/src/useApi.ts packages/use-api/src/__tests__/useApi.executeConfig.test.ts
git commit -m "fix(execute): filter useApi-only options out of per-call axios config"
```

---

### Task 2: Devtools — plug the `pendingCalls` leak and skip instrumentation when disabled

**Why:** With devtools not configured, `bridge` stays `null` forever, and every `useApi()` call pushes a closure into `pendingCalls` — unbounded growth (amplified by `useApiBatch`, which creates one instance per item per execution). The devtools deep-watch also runs for every instance even when devtools is off.

**Files:**
- Modify: `packages/use-api/src/devtools.ts`
- Modify: `packages/use-api/src/plugin.ts`
- Modify: `packages/use-api/src/useApi.ts` (~lines 92–113)
- Test: `packages/use-api/src/__tests__/devtools.test.ts` (append; read it first — it uses `src/__mocks__/@ametie/vue-muza-devtools.ts`)

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/devtools.test.ts` (match its existing imports/mocks):

```ts
import { devtoolsBridge, __devtoolsInternals } from "../devtools";

describe("devtools — pending queue hygiene", () => {
    beforeEach(() => {
        __devtoolsInternals().reset();
    });

    it("does not queue instance events when devtools was never configured", () => {
        // devtoolsExpected is false after reset — simulates production without devtools
        devtoolsBridge.onInstanceCreated("i1", "/a", {
            authMode: "default", cache: undefined, retry: false, poll: 0, immediate: false, lazy: false,
        });
        expect(__devtoolsInternals().pendingCount()).toBe(0);
    });

    it("queues when devtools is expected, and drops the entry if the instance is destroyed before the bridge loads", () => {
        __devtoolsInternals().setExpected(true);
        devtoolsBridge.onInstanceCreated("i2", "/b", {
            authMode: "default", cache: undefined, retry: false, poll: 0, immediate: false, lazy: false,
        });
        expect(__devtoolsInternals().pendingCount()).toBe(1);

        devtoolsBridge.onInstanceDestroyed("i2");
        expect(__devtoolsInternals().pendingCount()).toBe(0);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/__tests__/devtools.test.ts`
Expected: FAIL — `__devtoolsInternals` is not exported.

- [ ] **Step 3: Rework `devtools.ts`**

Replace the module-state block and the two affected methods:

```ts
let bridge: DevtoolsBridge | null = null;
let devtoolsExpected = false;
let requestCounter = 0;
// Keyed by instance id so a destroy can remove its own queued "created" event.
// Only onInstanceCreated ever queues — all other bridge methods are no-ops until load.
const pendingInstances = new Map<string, () => void>();

/**
 * Marks whether a devtools bridge is ever going to load for this app.
 * Called synchronously from createApi() — before any useApi() instance exists —
 * so instrumentation can skip all queueing/watching when devtools is off.
 */
export function setDevtoolsExpected(expected: boolean): void {
    devtoolsExpected = expected;
}

/** Whether devtools was configured for this app (bridge loaded or loading). */
export function isDevtoolsExpected(): boolean {
    return devtoolsExpected;
}

/** @internal Test-only accessors — not exported from index.ts. */
export function __devtoolsInternals() {
    return {
        pendingCount: () => pendingInstances.size,
        setExpected: (v: boolean) => { devtoolsExpected = v; },
        reset: () => {
            bridge = null;
            devtoolsExpected = false;
            pendingInstances.clear();
        },
    };
}
```

Update `initDevtools` to flush the Map:

```ts
export async function initDevtools(options: DevtoolsOptions, app: App): Promise<void> {
    if (!options.enabled) return;
    devtoolsExpected = true;
    bridge = _createBridge(options, app);
    for (const fn of pendingInstances.values()) fn();
    pendingInstances.clear();
}
```

Update the bridge proxy:

```ts
export const devtoolsBridge = {
    onInstanceCreated(id: string, url: string | undefined, options: DevtoolsInstanceOptions): void {
        if (bridge) {
            bridge.onInstanceCreated(id, url, options);
        } else if (devtoolsExpected) {
            pendingInstances.set(id, () => bridge?.onInstanceCreated(id, url, options));
        }
    },
    onInstanceDestroyed(id: string): void {
        pendingInstances.delete(id);
        bridge?.onInstanceDestroyed(id);
    },
    // onStateUpdate / onRequestStart / onRequestEnd unchanged
    ...
} satisfies DevtoolsBridge;
```

- [ ] **Step 4: Wire `setDevtoolsExpected` in `plugin.ts`**

```ts
import { initDevtools, setDevtoolsExpected } from "./devtools";

export function createApi(options: ApiPluginOptions) {
    globalConfig = options;
    setDevtoolsExpected(options.devtools?.enabled === true);

    return {
        install(app: App) {
            app.provide(API_INJECTION_KEY, options);
            if (options.devtools) {
                void initDevtools(options.devtools, app);
            }
        },
    };
}
```

- [ ] **Step 5: Gate the devtools block in `useApi.ts`**

Wrap the state watch (lines ~102–113) — the `onInstanceCreated` call itself is now a cheap no-op, leave it:

```ts
    if (getCurrentScope() && isDevtoolsExpected()) {
        watch(
            () => ({
                loading: state.loading.value,
                error: state.error.value,
                statusCode: state.statusCode.value,
                data: state.data.value,
            }),
            (s) => devtoolsBridge.onStateUpdate(instanceId, s),
            { deep: true },
        );
    }
```

Add `isDevtoolsExpected` to the import from `./devtools`.

- [ ] **Step 6: Fix fallout in existing devtools tests**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/__tests__/devtools.test.ts src/__tests__/useApi.devtools.test.ts src/plugin.test.ts`
Existing tests that call `initDevtools` directly or rely on state updates must now see `devtoolsExpected === true`. `initDevtools({ enabled: true })` sets it itself; tests that only mount `createApi({ devtools: { enabled: true } })` also get it via `createApi`. Tests relying on queue-then-flush *without* configuring devtools must be updated to call `__devtoolsInternals().setExpected(true)` first. Add `__devtoolsInternals().reset()` to `beforeEach` of both devtools test files to kill cross-test module state.

- [ ] **Step 7: Full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green.

- [ ] **Step 8: Commit (after user confirmation)**

```bash
git add packages/use-api/src/devtools.ts packages/use-api/src/plugin.ts packages/use-api/src/useApi.ts packages/use-api/src/__tests__/devtools.test.ts packages/use-api/src/__tests__/useApi.devtools.test.ts
git commit -m "fix(devtools): prevent unbounded pending-event queue and skip instrumentation when devtools is disabled"
```

---

### Task 2b: Devtools — record token-refresh requests (depends on Task 2)

**Why:** Devtools instrumentation lives only in `useApi.executeRequest`. The refresh POST fires inside the axios response interceptor (`interceptors.ts`, `axiosInstance.post(refreshUrl, ...)`) — completely outside useApi — so it never appears in the Network tab. Users see the original 401'd request hang as "pending" for the whole refresh+replay with no explanation. The devtools panel already supports standalone records: `DevtoolsRequestRecord.instanceId` is `string | null`, and the panel's own types document `null` as "standalone requests" (`packages/devtools/src/shared/types/index.ts:58`) — no panel changes required.

**Security constraint:** the refresh response body contains fresh `accessToken`/`refreshToken` (and the payload may carry fingerprints). Token-bearing fields MUST be redacted before the record reaches the devtools history buffer.

**Files:**
- Modify: `packages/use-api/src/devtools.ts` (add `redactTokenFields`)
- Modify: `packages/use-api/src/features/interceptors.ts` (instrument the refresh call)
- Test: `packages/use-api/src/features/interceptors.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/features/interceptors.test.ts` (reuse the file's existing helpers for capturing the response-error interceptor and mocking the refresh POST; adapt names):

```ts
import { devtoolsBridge, __devtoolsInternals } from "../devtools";

describe("devtools — refresh request visibility", () => {
    beforeEach(() => __devtoolsInternals().reset());
    afterEach(() => vi.restoreAllMocks());

    it("records the refresh POST as a standalone request on success", async () => {
        __devtoolsInternals().setExpected(true);
        const startSpy = vi.spyOn(devtoolsBridge, "onRequestStart");
        const endSpy = vi.spyOn(devtoolsBridge, "onRequestEnd");

        await runSuccessfulRefreshFlow(); // arrange 401 + refresh 200 via existing helpers

        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
            url: "/auth/refresh",
            method: "POST",
            instanceId: null,
            status: "pending",
        }));
        expect(endSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: "success", statusCode: 200 }),
        );
    });

    it("redacts token fields in the recorded refresh response", async () => {
        __devtoolsInternals().setExpected(true);
        const endSpy = vi.spyOn(devtoolsBridge, "onRequestEnd");

        await runSuccessfulRefreshFlow(); // refresh responds { accessToken: "new-a", refreshToken: "new-r" }

        const result = endSpy.mock.calls[0][1];
        expect(result).toMatchObject({
            response: { accessToken: "•••redacted•••", refreshToken: "•••redacted•••" },
        });
    });

    it("records an error entry when the refresh itself fails", async () => {
        __devtoolsInternals().setExpected(true);
        const endSpy = vi.spyOn(devtoolsBridge, "onRequestEnd");

        await runFailedRefreshFlow(); // refresh responds 401/500

        expect(endSpy).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: "error" }),
        );
    });

    it("does not touch the bridge when devtools is not expected", async () => {
        // reset() left devtoolsExpected = false — production default
        const startSpy = vi.spyOn(devtoolsBridge, "onRequestStart");

        await runSuccessfulRefreshFlow();

        expect(startSpy).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/features/interceptors.test.ts`
Expected: FAIL — `onRequestStart` never called (no instrumentation exists).

- [ ] **Step 3: Add `redactTokenFields` to `devtools.ts`**

```ts
const TOKEN_KEY_RE = /token/i;

/**
 * Shallow-redact token-bearing fields before a record is handed to devtools.
 * Applied to auth-refresh payloads/responses so access/refresh tokens never
 * enter the devtools history buffer.
 */
export function redactTokenFields(value: unknown): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
        out[key] = TOKEN_KEY_RE.test(key) ? "•••redacted•••" : v;
    }
    return out;
}
```

(Not exported from `index.ts` — internal to the package; Brief F's `redact` hook can reuse it later.)

- [ ] **Step 4: Instrument the refresh call in `interceptors.ts`**

Add imports:

```ts
import { devtoolsBridge, nextRequestId, isDevtoolsExpected, redactTokenFields } from "../devtools";
import { parseApiError } from "../utils/errorParser";
```

In the 401 handler, declare before the `try` block (so `catch` can see them):

```ts
            let devtoolsId: string | null = null;
            let devtoolsStartedAt = 0;
```

Inside `try`, right after the payload is resolved (after the `shouldUseCredentials` line, before `axiosInstance.post`):

```ts
                if (isDevtoolsExpected()) {
                    devtoolsId = nextRequestId();
                    devtoolsStartedAt = Date.now();
                    devtoolsBridge.onRequestStart({
                        id: devtoolsId,
                        instanceId: null, // standalone — not tied to a useApi instance
                        url: refreshUrl,
                        method: "POST",
                        startedAt: devtoolsStartedAt,
                        status: "pending",
                        statusCode: null,
                        requestHeaders: {},
                        payload: redactTokenFields(payload),
                        queryParams: null,
                    });
                }
```

Right after `const response = await axiosInstance.post(...)` resolves:

```ts
                if (devtoolsId !== null) {
                    devtoolsBridge.onRequestEnd(devtoolsId, {
                        status: "success",
                        statusCode: response.status,
                        response: redactTokenFields(response.data),
                        duration: Date.now() - devtoolsStartedAt,
                    });
                }
```

At the top of the `catch (refreshError)` block:

```ts
                if (devtoolsId !== null) {
                    const apiError = parseApiError(refreshError);
                    devtoolsBridge.onRequestEnd(devtoolsId, {
                        status: "error",
                        error: apiError,
                        statusCode: apiError.status || null,
                        duration: Date.now() - devtoolsStartedAt,
                    });
                }
```

Note: the plugin-level custom `errorParser` is not reachable from interceptors (no plugin config there) — the default `parseApiError` is fine for devtools display.

- [ ] **Step 5: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green.

- [ ] **Step 6: Manual verification in the playground**

Run the playground with devtools enabled, trigger a 401→refresh flow, and confirm: (a) the refresh POST appears in the Network tab with redacted tokens; (b) the original request's long "pending" period now has a visible explanation; (c) the Network tab's instance filter still works (the refresh entry has no instance — it must appear under "all").

- [ ] **Step 7: Commit (after user confirmation)**

```bash
git add packages/use-api/src/devtools.ts packages/use-api/src/features/interceptors.ts packages/use-api/src/features/interceptors.test.ts
git commit -m "fix(devtools): record token-refresh requests as standalone entries with redacted tokens"
```

**Optional follow-up (separate, not in this task):** surface `AuthEventType` events (REFRESH_START / REQUEST_QUEUED / REFRESH_SUCCESS / REFRESH_ERROR from `monitor.ts`) in the devtools Timeline tab — would show *why* queued requests waited. Needs changes in `packages/devtools` (new event source) — brief it separately if wanted.

---

### Task 3: Register the poll `visibilitychange` listener only when polling is configured

**Why:** `useApi.ts:490` adds a document listener for every instance, poll or not. One listener per instance = overhead, and a leak when `useApi` runs outside a Vue scope.

**Files:**
- Modify: `packages/use-api/src/useApi.ts` (~line 490)
- Test: create `packages/use-api/src/useApi.pollListener.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import type { AxiosInstance } from "axios";
import { useApi } from "./useApi";
import { createApi } from "./plugin";
import type { UseApiOptions } from "./types";

const mockAxios = {
    request: vi.fn().mockResolvedValue({ data: "ok", status: 200 }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

beforeEach(() => vi.clearAllMocks());

function mountApi(options: UseApiOptions = {}) {
    return mount(
        defineComponent({
            setup() {
                useApi("/x", options);
                return () => null;
            },
        }),
        { global: { plugins: [createApi({ axios: mockAxios })] } },
    );
}

describe("useApi — poll visibility listener", () => {
    it("registers no visibilitychange listener when poll is not configured", () => {
        const spy = vi.spyOn(document, "addEventListener");
        mountApi();
        const calls = spy.mock.calls.filter(([evt]) => evt === "visibilitychange");
        expect(calls).toHaveLength(0);
        spy.mockRestore();
    });

    it("registers the listener when poll is configured, and removes it on unmount", () => {
        const addSpy = vi.spyOn(document, "addEventListener");
        const removeSpy = vi.spyOn(document, "removeEventListener");
        const wrapper = mountApi({ poll: 5000 });
        expect(addSpy.mock.calls.filter(([evt]) => evt === "visibilitychange")).toHaveLength(1);

        wrapper.unmount();
        expect(removeSpy.mock.calls.filter(([evt]) => evt === "visibilitychange")).toHaveLength(1);
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/useApi.pollListener.test.ts`
Expected: first test FAILS (1 listener found).

- [ ] **Step 3: Implement**

In `useApi.ts`, change the guard (~line 490):

```ts
    // Visibility handling for polling — only when polling is configured.
    // `poll` may be a ref/getter (always truthy) — that's fine: the handler
    // itself re-reads getPollConfig() and no-ops when the interval is 0.
    if (poll && typeof document !== "undefined") {
```

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green (poll tests exercise `poll: <number>`, still truthy).

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/useApi.ts packages/use-api/src/useApi.pollListener.test.ts
git commit -m "fix(poll): register visibilitychange listener only when polling is configured"
```

---

### Task 4: Fix dead `initialLoading ?? immediate` default

**Why:** `useApi.ts:72` destructures `initialLoading = false`, so line 88's `initialLoading ?? immediate` never falls through to `immediate`. Observable bug: `immediate: true` + `debounce` shows `loading: false` during the initial debounce window.

**Files:**
- Modify: `packages/use-api/src/useApi.ts` (lines 72, 88)
- Test: create `packages/use-api/src/useApi.initialLoading.test.ts`

- [ ] **Step 1: Write the failing test**

Use the same `mockAxios`/`mountApi` preamble as Task 3's test file (copy it — files must be self-contained), then:

```ts
describe("useApi — initialLoading defaults", () => {
    it("loading is true during the initial debounce window when immediate: true", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x", { immediate: true, debounce: 50 });
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        // execute() is debounced — no sync setLoading(true) yet.
        // startLoading must have defaulted to `immediate`.
        expect(api.loading.value).toBe(true);
    });

    it("explicit initialLoading: false wins over immediate", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x", { immediate: true, debounce: 50, initialLoading: false });
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        expect(api.loading.value).toBe(false);
    });

    it("loading is false by default (no immediate)", () => {
        let api!: ReturnType<typeof useApi>;
        mount(
            defineComponent({
                setup() {
                    api = useApi("/x");
                    return () => null;
                },
            }),
            { global: { plugins: [createApi({ axios: mockAxios })] } },
        );
        expect(api.loading.value).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/useApi.initialLoading.test.ts`
Expected: first test FAILS (`loading.value` is `false`).

- [ ] **Step 3: Implement**

In the options destructuring (line 72), remove the default:

```ts
        initialLoading,
```

Line 88 stays:

```ts
    const startLoading = initialLoading ?? immediate;
```

(Now `??` actually works: `undefined ?? immediate` → `immediate`.)

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green. Watch for existing tests asserting `loading === false` right after mount with `immediate: true` — with no debounce the sync `execute()` already set loading true before, so behavior there is unchanged; only debounce+immediate combos change.

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/useApi.ts packages/use-api/src/useApi.initialLoading.test.ts
git commit -m "fix(loading): default initialLoading to immediate so debounced immediate requests show loading"
```

---

### Task 5: Refresh-endpoint detection by pathname, not substring

**Why:** `interceptors.ts:114` uses `url.includes(refreshUrl)`. A 401 from `/auth/refresh-devices` is misclassified as a failed token refresh → tokens cleared, `onTokenRefreshFailed` fired, user logged out.

**Files:**
- Modify: `packages/use-api/src/features/interceptors.ts`
- Test: `packages/use-api/src/features/interceptors.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Read `interceptors.test.ts` first and reuse its axios-instance/interceptor-capture helpers. Append:

```ts
describe("refresh endpoint matching", () => {
    it("does NOT treat /auth/refresh-devices as the refresh endpoint", async () => {
        // Arrange: token exists; a 401 arrives from a URL that merely *contains* the refresh path
        localStorage.setItem("accessToken", "old-token");
        const error = make401Error("/auth/refresh-devices"); // use the file's existing error factory
        const clearSpy = vi.spyOn(tokenManager, "clearTokens");

        // Act: run the captured response-error interceptor; the refresh POST it triggers can be mocked to fail
        await expect(responseErrorHandler(error)).rejects.toBeDefined();

        // Assert: it attempted the normal refresh flow (refresh POST fired),
        // i.e. it did NOT short-circuit into the "refresh itself failed" branch.
        expect(postSpy).toHaveBeenCalledWith("/auth/refresh", expect.anything(), expect.anything());
        clearSpy.mockRestore();
    });

    it("still detects the exact refresh URL with a query string", async () => {
        const error = make401Error("/auth/refresh?device=web");
        const clearSpy = vi.spyOn(tokenManager, "clearTokens");

        await expect(responseErrorHandler(error)).rejects.toBeDefined();

        // Refresh endpoint itself failed → tokens cleared, no second refresh attempt
        expect(clearSpy).toHaveBeenCalled();
        expect(postSpy).not.toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
```

Adapt `make401Error` / `responseErrorHandler` / `postSpy` to the file's actual helper names; if none exist, follow the pattern already used in that file for capturing `axiosInstance.interceptors.response.use` handlers.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/features/interceptors.test.ts`
Expected: first test FAILS — with `includes()`, `/auth/refresh-devices` short-circuits into the refresh-failed branch (no refresh POST, tokens cleared).

- [ ] **Step 3: Implement**

In `interceptors.ts`, add above `setupInterceptors` (internal helper — no JSDoc required, but one line of intent):

```ts
/**
 * Match the refresh endpoint by pathname suffix, not substring —
 * prevents URLs like /auth/refresh-devices being treated as the refresh call.
 */
function isRefreshRequest(url: string | undefined, refreshUrl: string): boolean {
    if (!url) return false;
    const path = url.split("?")[0].split("#")[0];
    return path === refreshUrl || path.endsWith(refreshUrl);
}
```

Replace line 114:

```ts
            if (isRefreshRequest(originalRequest.url, refreshUrl)) {
```

(`endsWith` keeps absolute URLs working: `https://api.x.com/auth/refresh` ends with `/auth/refresh`; `/reauth/refresh` does not — the leading `/` in the default `refreshUrl` anchors the segment.)

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green.

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/features/interceptors.ts packages/use-api/src/features/interceptors.test.ts
git commit -m "fix(auth): match refresh endpoint by pathname instead of substring"
```

---

### Task 6: `useAbortController` — fresh `signal` after abort + axios-aware `isAbortError`

**Why:** `signal` is snapshotted once (`readonly(ref(abortController.signal))`); after the first `abort()` it forever points at the old aborted signal — the JSDoc example (`{ signal: signal.value }`) is broken. `isAbortError` checks DOM `AbortError`, but axios cancellations are `CanceledError`/`ERR_CANCELED` — it never matches in this stack.

**Files:**
- Modify: `packages/use-api/src/composables/useAbortController.ts`
- Test: `packages/use-api/src/composables/useAbortController.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```ts
import { CanceledError } from "axios";

describe("useAbortController — signal freshness", () => {
    it("signal reflects the NEW controller after abort()", () => {
        const { signal, abort } = useAbortController();
        const before = signal.value;

        abort();

        expect(before.aborted).toBe(true);
        expect(signal.value).not.toBe(before);
        expect(signal.value.aborted).toBe(false);
    });
});

describe("useAbortController — isAbortError", () => {
    it("recognises axios CanceledError", () => {
        const { isAbortError } = useAbortController();
        expect(isAbortError(new CanceledError("canceled"))).toBe(true);
    });

    it("still recognises DOM AbortError and rejects ordinary errors", () => {
        const { isAbortError } = useAbortController();
        expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
        expect(isAbortError(new Error("nope"))).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/composables/useAbortController.test.ts`
Expected: "signal reflects the NEW controller" FAILS, "recognises axios CanceledError" FAILS.

- [ ] **Step 3: Implement**

Rewrite `useAbortController.ts` (keep the module-level singleton pattern; match the file's existing 2-space indent):

```ts
import { ref, computed, readonly, type ComputedRef, type Ref } from "vue";
import { isCancel } from "axios";

// Singleton instance
let abortController = new AbortController();
const abortCount = ref(0);

/** Return shape of `useAbortController`. */
export interface UseAbortControllerReturn {
  /** Signal of the CURRENT controller — re-evaluates after every abort(). */
  signal: ComputedRef<AbortSignal>;
  /** Abort all pending requests and create a fresh controller. */
  abort: () => void;
  /** Get the current AbortSignal (non-reactive read). */
  getSignal: () => AbortSignal;
  /** True for DOM AbortError and axios cancellation errors. */
  isAbortError: (error: unknown) => boolean;
  /** Number of times abort() has been called. */
  abortCount: Readonly<Ref<number>>;
}

/**
 * Global abort controller for cancelling all in-flight API requests
 * (e.g. when global filters change).
 *
 * @example
 * const { abort } = useAbortController();
 * abort(); // cancels every request started with useGlobalAbort: true
 */
export function useAbortController(): UseAbortControllerReturn {
  const signal = computed(() => {
    void abortCount.value; // re-evaluate after each abort() swaps the controller
    return abortController.signal;
  });

  const abort = () => {
    // IMPORTANT: increment BEFORE aborting, so abort handlers see the new value
    abortCount.value++;
    abortController.abort();
    abortController = new AbortController();
  };

  const getSignal = (): AbortSignal => abortController.signal;

  const isAbortError = (error: unknown): boolean =>
    (error instanceof DOMException && error.name === "AbortError") || isCancel(error);

  return {
    signal,
    abort,
    getSignal,
    isAbortError,
    abortCount: readonly(abortCount),
  };
}
```

Note: `signal`'s public type changes from `Readonly<Ref>` to `ComputedRef` — structurally compatible for consumers (both are readonly refs); this is a fix, not a break.

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green (existing tests in that file use `getSignal()`/`abortCount` — unaffected).

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/composables/useAbortController.ts packages/use-api/src/composables/useAbortController.test.ts
git commit -m "fix(abort): keep signal ref fresh after abort and detect axios cancellations in isAbortError"
```

---

### Task 7: Safe `localStorage` access in `tokenManager`

**Why:** Safari private mode / storage-blocked iframes throw on any `localStorage` access — currently that exception propagates out of the request interceptor and kills every request.

**Files:**
- Modify: `packages/use-api/src/features/tokenManager.ts`
- Test: `packages/use-api/src/features/tokenManager.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

```ts
describe("LocalStorageTokenStorage — storage unavailable", () => {
    afterEach(() => vi.restoreAllMocks());

    it("getAccessToken returns null instead of throwing", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError: denied");
        });
        const storage = new LocalStorageTokenStorage();
        expect(storage.getAccessToken()).toBeNull();
    });

    it("setTokens does not throw", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
        });
        const storage = new LocalStorageTokenStorage();
        expect(() => storage.setTokens({ accessToken: "a" })).not.toThrow();
    });

    it("clearTokens does not throw", () => {
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("SecurityError: denied");
        });
        const storage = new LocalStorageTokenStorage();
        expect(() => storage.clearTokens()).not.toThrow();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/features/tokenManager.test.ts`
Expected: all three FAIL (throw).

- [ ] **Step 3: Implement**

Add module-level helpers above `LocalStorageTokenStorage` (internal — no JSDoc needed):

```ts
// localStorage can throw (Safari private mode, storage-blocked iframes).
// Degrade to "no token" instead of crashing the request interceptor.
function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // storage unavailable — token lives only for this request cycle
    }
}

function safeRemoveItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // storage unavailable — nothing to remove
    }
}
```

Replace every direct `localStorage.getItem/setItem/removeItem` call inside `LocalStorageTokenStorage` with the safe helpers (6 call sites: `getAccessToken`, `getRefreshToken`, `setTokens` ×2 (+expires), `clearTokens` ×3, `getTokenExpiresAt`).

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green.

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/features/tokenManager.ts packages/use-api/src/features/tokenManager.test.ts
git commit -m "fix(auth): tolerate unavailable localStorage instead of crashing the interceptor"
```

---

### Task 8: `params` gets its own generic (decoupled from body type `D`)

**Why:** `ApiRequestConfig.params?: MaybeRefOrGetter<D> | D` forces query params into the request-*body* type. A typed POST body makes correctly-shaped params a type error.

**Files:**
- Modify: `packages/use-api/src/types.ts` (~lines 47–49)
- Test: type-level only — verified by `tsc` and existing suite

- [ ] **Step 1: Implement the type change**

Append a new generic with a safe default (appending with a default breaks no existing explicit instantiation):

```ts
export interface ApiRequestConfig<D = unknown, P = unknown> extends Omit<AxiosRequestConfig<D>, "data" | "params"> {
    data?: MaybeRefOrGetter<D> | D;
    params?: MaybeRefOrGetter<P> | P;
    // ... rest unchanged
}
```

`UseApiOptions<T, D, TSelected> extends ApiRequestConfig<D>` — leave as is (`P` defaults to `unknown`, so params accept anything, which is strictly more correct than "must match the body type"). Same for `UseApiBatchOptions` and `ExecuteConfig` — no edits needed.

- [ ] **Step 2: Type-check and run the suite**

Run: `pnpm --filter @ametie/vue-muza-use exec tsc --noEmit && pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: clean compile, all tests green.

- [ ] **Step 3: Commit (after user confirmation)**

```bash
git add packages/use-api/src/types.ts
git commit -m "fix(types): decouple params type from request body generic"
```

---

### Task 9: Docs-in-code cleanup — dangling `poll` JSDoc, duplicated `AuthTokens`/`TOKEN_TYPE`, deprecate dead refresh-promise API

**Why:** (a) `types.ts:160-165` — the polling JSDoc block is orphaned above `cache`, so `poll` shows no docs in IDEs; (b) `AuthTokens` is declared in both `types.ts` and `tokenManager.ts`, `TOKEN_TYPE` in both `tokenManager.ts` and `interceptors.ts` — drift risk; (c) `TokenManager.setRefreshPromise/getRefreshPromise/clearRefreshPromise` are dead code, but removing public methods is breaking — deprecate now, remove in v2.

**Files:**
- Modify: `packages/use-api/src/types.ts`
- Modify: `packages/use-api/src/features/tokenManager.ts`
- Modify: `packages/use-api/src/features/interceptors.ts`

- [ ] **Step 1: Fix the dangling JSDoc in `types.ts`**

Delete the orphaned block (lines ~160–165: `/** Polling configuration. ... */` sitting above the `cache` doc) and move its content onto the `poll` property (line ~182):

```ts
    /**
     * Polling configuration.
     * - Pass a **number** (ms) for simple polling.
     * - Pass an **object** `{ interval: number, whenHidden?: boolean }` for advanced control.
     * Properties inside the object can also be Refs.
     */
    poll?: MaybeRefOrGetter<number | { interval: MaybeRefOrGetter<number>; whenHidden?: MaybeRefOrGetter<boolean> }>;
```

- [ ] **Step 2: Deduplicate `AuthTokens`**

In `tokenManager.ts`, delete the local `AuthTokens` interface (lines ~11–15) and replace with:

```ts
import type { AuthTokens } from "../types";

export type { AuthTokens };
```

(The re-export preserves `import { type AuthTokens } from ".../tokenManager"` for any existing internal consumer.)

- [ ] **Step 3: Deduplicate `TOKEN_TYPE`**

In `interceptors.ts`, delete `export const TOKEN_TYPE = "Bearer";` (line 7) and change the imports:

```ts
import { tokenManager, TOKEN_TYPE } from "./tokenManager";

export { TOKEN_TYPE };
```

(`AUTH_HEADER` stays where it is.)

- [ ] **Step 4: Deprecate the dead refresh-promise API in `tokenManager.ts`**

Add `@deprecated` JSDoc to all three methods (keep bodies unchanged):

```ts
    /**
     * @deprecated Not used by the library — the 401 refresh mutex lives in
     * `setupInterceptors()` (`isRefreshing` + `failedQueue`). Will be removed in v2.0.
     */
    setRefreshPromise(promise: Promise<string | null>): void {
```

(Repeat the same annotation for `getRefreshPromise` and `clearRefreshPromise`.)

- [ ] **Step 5: Type-check + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec tsc --noEmit && pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: clean, all green.

- [ ] **Step 6: Commit (after user confirmation)**

```bash
git add packages/use-api/src/types.ts packages/use-api/src/features/tokenManager.ts packages/use-api/src/features/interceptors.ts
git commit -m "refactor(types): fix dangling poll JSDoc, dedupe AuthTokens/TOKEN_TYPE, deprecate unused refresh-promise API"
```

---

# Phase 2 — P1 documentation & skill sync (no release)

### Task 10: Rewrite `.claude/skills/use-api/SKILL.md` → v1.4

**Why:** The skill teaches a `watch` option that no longer exists (TS error for consumers) and its mutation examples fire POSTs on every form keystroke under the current auto-tracking default.

**Files:**
- Modify: `.claude/skills/use-api/SKILL.md`

- [ ] **Step 1: Metadata**

Set `version` to `1.4` and add a row: `| **verified_against** | @ametie/vue-muza-use 1.5.4 |`.

- [ ] **Step 2: Remove `watch` everywhere**

In the "runtime request behavior" options list (~line 60): delete the `watch` bullet.
In every code example (~lines 168, 272, 290, 456): delete the `watch: [...]` lines — auto-tracking makes them redundant. E.g. the table request becomes:

```ts
const { loading, data } = fetchProducts({
  params: () => ({
    ...filters.value,
    page: page.value,
    sort: sort.value,
  }),
  immediate: true,
});
```

- [ ] **Step 3: Add an "Auto-tracking (IMPORTANT)" section right after "Core idea"**

```markdown
## Auto-tracking (IMPORTANT)

`useApi` automatically re-fetches when reactive dependencies inside the `url`,
`params`, or `data` getters change. There is **no `watch` option** — passing one
is a TypeScript error.

- **Reads (GET):** pass getters, get auto-refetch for free. `immediate: true`
  fires the initial request.
- **Mutations (POST/PUT/PATCH/DELETE) and manual requests:** ALWAYS pass
  `lazy: true`. Without it, a reactive `data: () => form.value` getter fires
  the mutation on every form edit.
- **Escape hatch:** `ignoreUpdates(() => { ... })` mutates reactive deps
  without triggering a request (synchronous changes only).

```ts
// ✅ read — auto-tracked
const { data } = fetchProducts({
  params: () => ({ page: page.value }),
  immediate: true,
});

// ✅ mutation — lazy + manual execute()
const { execute } = saveProduct({
  data: () => form.value,
  lazy: true,
});
```
```

- [ ] **Step 4: Fix the mutation scenarios**

Scenario 4 (Save / mutation):

```ts
const { loading, execute } = saveItem({
  data: () => form.value,
  lazy: true,           // REQUIRED: without it every form edit fires the request
  onSuccess: () => router.push("/list"),
});
```

Scenario 6 (Manual request):

```ts
const { loading, execute } = fetchOnDemand({
  data: () => payload.value,
  lazy: true,           // manual control — deps must not auto-trigger
});
// called manually: execute()
```

Scenario 3 (Search) keeps auto-tracking (it is the desired behavior) — just delete its `watch: [searchQuery]` line.

- [ ] **Step 5: Fix duplicate numbering**

There are two "### 7." sections ("execute() with per-call options" and "Batch request"). Renumber the batch section to "### 8." (and any later ones accordingly).

- [ ] **Step 6: Add a security note section (before "Forbidden patterns")**

```markdown
## Security notes — token storage

`createApiClient` supports three auth modes (see `withCredentials` docs). Defaults
store BOTH tokens in localStorage — acceptable for internal tools, but any XSS can
exfiltrate the long-lived refresh token. For production apps prefer:

```ts
// Hybrid: Bearer access token + httpOnly refresh cookie
createApiClient({
  baseURL: "/api",
  authOptions: { refreshWithCredentials: true },
})
```

Also call `clearAllCache()` on logout — the in-memory cache is shared and
otherwise survives across user sessions.
```

- [ ] **Step 7: Mention the missing surface**

In the "Advanced options reference" table add rows for: `mutate` (manual data mutation on the return), `poll` object form `{ interval, whenHidden }`, `authMode: "public" | "optional"` (skip/soften auth), `initialData`/`initialLoading`, `useGlobalAbort` + `useAbortController()`. For batch add one sentence covering `concurrency`, `progress`, `settled`.

- [ ] **Step 8: Verify every code block against `types.ts`**

Manually check each remaining example compiles conceptually against `UseApiOptions` (no `watch`, no `select` inside `execute()`). No automated check exists — read carefully.

- [ ] **Step 9: Commit (after user confirmation)**

```bash
git add .claude/skills/use-api/SKILL.md
git commit -m "docs(skill): v1.4 — remove nonexistent watch option, require lazy for mutations, document auto-tracking and token security"
```

---

### Task 11: Fix agent instructions (workflow command, architecture map, test layout)

**Files:**
- Modify: `.agents/instructions/workflow.md`
- Modify: `.agents/instructions/testing.instructions.md`
- Modify: `.agents/instructions/library-architecture.instructions.md`

- [ ] **Step 1: `workflow.md` — fix the broken test commands**

Replace every `pnpm --filter @ametie/vue-muza-use test --run` with:

```bash
pnpm --filter @ametie/vue-muza-use exec vitest run
```

and the watch-a-file example with:

```bash
pnpm --filter @ametie/vue-muza-use exec vitest src/useApi.swr.test.ts
```

- [ ] **Step 2: `testing.instructions.md` — document the real test layout**

Replace "All tests live in `packages/use-api/src/__tests__/`." with:

```markdown
Tests are co-located with their subject (`<file>.test.ts` next to the source file);
cross-cutting integration tests live in `packages/use-api/src/__tests__/`.
For a new feature, prefer co-location: `src/useApi.<feature>.test.ts`.
```

Also fix its "Running Tests" section with the same command corrections as Step 1.

- [ ] **Step 3: `library-architecture.instructions.md` — complete the layer map**

Add to the map (after `useApi.helpers.ts`):

```
  devtools.ts                    ← devtools bridge proxy (no-op when devtools disabled)
  utils/urlUtils.ts              ← parse query params from URL strings (devtools display)
```

Also fix `project.md`'s repository structure: it lists only `use-api` and `playground`, but the workspace contains `packages/devtools` (`@ametie/vue-muza-devtools` — the devtools panel, published separately) and `playground` lives at the repo root, not under `packages/`. Add:

```
├── packages/
│   ├── use-api/          # Main library — @ametie/vue-muza-use
│   └── devtools/         # Devtools panel — @ametie/vue-muza-devtools
├── playground/           # Dev/test sandbox — not published
```

(Verify the actual layout with `ls` before writing — match reality, not this snippet.)

- [ ] **Step 4: Commit (after user confirmation)**

```bash
git add .agents/instructions/workflow.md .agents/instructions/testing.instructions.md .agents/instructions/library-architecture.instructions.md
git commit -m "docs(agents): fix test commands, document real test layout, complete architecture map"
```

---

### Task 12: README sync for Phase 1 changes

**Files:**
- Modify: `packages/use-api/README.md`

- [ ] **Step 1: Update affected sections**

1. `execute()` per-call table: remove `select` from overridable options if listed; note that useApi-only keys are no longer forwarded to axios.
2. `useAbortController` docs/examples: `signal` is now always current after `abort()`; `isAbortError` detects axios cancellations.
3. `initialLoading` option row: document the new default — "`initialLoading` defaults to the value of `immediate`".
4. Add a "Storage resilience" sentence to the auth section: token storage degrades gracefully when localStorage is unavailable.
5. Grep the README for `watch:` inside `useApi` examples (NOT `useApiBatch`) and remove any stragglers: `grep -n "watch:" packages/use-api/README.md`.

- [ ] **Step 2: Commit (after user confirmation)**

```bash
git add packages/use-api/README.md
git commit -m "docs(readme): sync execute() hygiene, abort signal freshness, initialLoading default"
```

---

# Phase 3 — P2 feature design briefs (each `minor`, each needs its own brainstorm → plan before coding)

> **Executor note:** These are NOT ready-to-execute tasks. Each brief locks in the
> types-first surface and test matrix, but requires `superpowers:brainstorming` +
> `superpowers:writing-plans` to become an implementation plan. Do not start these
> without the user choosing one.

### Brief A: Request deduplication `[minor]`

- **Option (types.ts):** `dedupe?: boolean` on `UseApiOptions` (default `false`).
- **Module:** `features/dedupeManager.ts` — `Map<string, { promise: Promise<AxiosResponse>; consumers: number }>`. Key = cache id when present, else `` `${method} ${url} ${stableStringify(params)}` ``.
- **Semantics:** concurrent executes with the same key await one axios call; each consumer still runs its own `select`/callbacks/state updates.
- **Hard design question (resolve in brainstorm):** abort semantics — one consumer aborting must not kill the shared request while others wait → refcount, abort the underlying request only when consumers hit 0.
- **Test matrix:** default off (2 calls = 2 requests); on (2 calls = 1 request, both get data); different keys don't collide; abort of one consumer; error propagates to all consumers; cleanup on scope dispose.

### Brief B: Auto cache keys `[minor]`

- **Option (types.ts):** widen `cache?: boolean | string | CacheOptions`; `cache: true` derives `` `auto:${method}:${url}:${stableStringify(params)}` `` at execute time.
- **Util:** `utils/stableStringify.ts` — JSON with sorted keys (needed by Brief A too — build once).
- **Change:** `normalizeCacheOptions` moves its call site inside `executeRequest` where `requestUrl`/`resolvedParams` are known (it already runs there — extend the signature).
- **Test matrix:** `cache: true` hit on same url+params; different params → different key (the exact hazard manual ids have today); invalidation of auto keys via returned key or documented pattern; SWR combo.

### Brief C: Retry backoff `[minor]`

- **Type (types.ts):** `retryDelay?: number | ((attempt: number) => number)` on `ApiRequestConfig`.
- **Implementation:** in `executeRequest`, `const delayMs = typeof effectiveRetryDelay === "function" ? effectiveRetryDelay(retryCount) : effectiveRetryDelay;` before `cancellableSleep`.
- **Docs:** README example `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000)`; add a WARNING box about retrying POSTs (duplicate side effects) — behavior guard itself is a v2 candidate, docs-only now.
- **Test matrix:** function delay called with 0,1,2…; per-call override via `ExecuteConfig`; global option still works with plain number.

### Brief D: Cache hardening — LRU cap + auth-wired wipe `[minor]`

- **Types:** `ApiPluginOptions.globalOptions.cacheMaxEntries?: number` (default `Infinity`); `InterceptorOptions.clearCacheOnAuthFailure?: boolean` (default `false`).
- **cacheManager:** on `writeCache`, if size > max — delete oldest by `cachedAt` (Map iteration order is fine if re-set on write; true LRU-on-read is optional).
- **interceptors:** in both token-clear paths (refresh-endpoint-401 and refresh-catch), call `clearAllCache()` when the flag is set.
- **Test matrix:** eviction order; cap of 0/1 edge cases; flag off = cache survives auth failure (current behavior); flag on = wiped.

### Brief E: Proactive token refresh + cross-tab coordination `[minor, complex — own plan mandatory]`

- **Idea:** request interceptor checks `tokenManager.isTokenExpired()` (currently dead code) and awaits a single-flight refresh BEFORE sending, resurrecting `tokenManager.refreshPromise` as the mutex (un-deprecate it or keep the mutex local to interceptors).
- **Cross-tab:** wrap refresh in `navigator.locks.request("muza:token-refresh", ...)` with a `BroadcastChannel` fallback broadcasting new tokens; other tabs re-read storage instead of refreshing.
- **Risks:** deadlocks on lock-holder tab close (locks auto-release — verify), clock skew on `expiresIn`, refresh loops when server clock differs. This brief is intentionally not scheduled with A–D.

### Brief F: Token key namespacing + devtools redaction `[minor]`

- **Types:** `LocalStorageTokenStorage({ prefix?: string })` (default `""` for backward compat; recommend `"muza:"` in docs); `CreateApiClientOptions.authOptions.tokenPrefix?: string` plumbed through; `DevtoolsOptions.redact?: (record: DevtoolsRequestRecord) => DevtoolsRequestRecord` applied in `devtoolsBridge.onRequestStart`.
- **Test matrix:** prefixed keys read/write/clear; two storages with different prefixes don't collide; redact hook strips a field from the record devtools receives.

### Brief H: Two-tier SWR freshness (`freshFor`) `[minor]`

- **Problem:** current `swr: true` revalidates on EVERY cache hit — there is no "fresh enough, skip the network" tier. `staleTime` is a hard expiry (≈ TanStack's `gcTime`); the equivalent of TanStack's `staleTime` is missing.
- **Type (types.ts):** `CacheOptions.freshFor?: number` — age below which a hit is served with NO background revalidation. Default `0` = current behavior (always revalidate), fully backward compatible.
- **Implementation:** `readCache` (or a new `readCacheEntry`) must expose `cachedAt` so `executeRequest` can compare age against `freshFor` before deciding to revalidate. Canonical daily-data recipe becomes: `cache: { id, swr: true, freshFor: HOUR, staleTime: Infinity }` + event-driven `invalidateCache`.
- **DX bonus (same PR):** export duration constants `MINUTE`, `HOUR`, `DAY` from `index.ts` (prevents the `24_000_000 ≠ 24h` class of bug).
- **Test matrix:** default (no freshFor → revalidates every hit, current behavior); fresh hit → no request; aged hit → serve + revalidate; `freshFor` + `staleTime: Infinity` combo; per-call `cache` override; interaction with `select` and `invalidateCache`.

### ~~Brief I: Persistent cache storage adapter~~ — DECLINED by maintainer (2026-07-06)

The maintainer explicitly does not want localStorage-backed cache persistence for now — the cache stays in-memory only. Do NOT re-propose this. If it ever comes back (long-lived data across reloads), the sketch lived in git history of this file; the preferred alternative today is HTTP-level caching (`ETag`/304) on such endpoints.

### Brief G: Shared focus/online manager `[patch — internal refactor]`

- **Module:** `features/focusManager.ts` — ONE `visibilitychange` + ONE `online` document/window listener, module-level `Set<() => void>` subscribers, `subscribeFocus(cb): () => void` / `subscribeOnline(cb): () => void`.
- **Change:** `useRefetchTriggers` and the `useApi` poll-visibility handler subscribe instead of adding their own listeners. N instances = 2 listeners total instead of up to 3N.
- **Test matrix:** two instances, one listener (spy on addEventListener); unsubscribe on scope dispose; last unsubscriber removes the DOM listener.

---

# Phase 4 — v2 candidates (deliberately NOT planned — batch for a major release)

Do not implement any of these in 1.x. Collected here so they aren't re-litigated:

1. `lazy: true` default for non-GET methods (kills the mutation footgun at the root).
2. Token storage default flips to httpOnly-refresh-cookie mode (`storeRefreshToken: false`).
3. Remove deprecated `useApiBatch.watch` option (already announced) and the deprecated refresh-promise API (deprecated in Task 9).
4. Explicit `index.ts` barrel — stop `export * from "./types"` leaking devtools-internal types (removing accidental exports is breaking).
5. Per-instance tokenManager bound to each `createApiClient` (kills the singleton contamination for multi-client apps).
6. **Transport abstraction** (`transport: { request(config) }` + own narrow `RequestConfig` instead of extending `AxiosRequestConfig`) — axios adapter stays the default, fetch adapter becomes possible without another major. Full assessment: analysis doc §8.

---

## Execution order & release strategy

| Batch | Tasks | Commits | Release effect |
|---|---|---|---|
| 1 | Tasks 1–8 (incl. 2b, after 2) | 9 × `fix(...)` | one patch bump on merge to main |
| 2 | Task 9 | 1 × `refactor(...)` | no release |
| 3 | Tasks 10–12 | 3 × `docs(...)` | no release |
| 4 | Briefs A–G | — | separate plans, each `feat(...)` = minor |

**Confirm with the user before every commit and before merging to main** (Semantic Release publishes automatically on main).

## Self-review checklist (done at plan-writing time)

- [x] Every §4/§5 analysis item maps to a task or an explicit deferral (§4.13 barrel → Phase 4; §4.15 batch plain-object throw → accepted, cosmetic; §5.1 default flip → Phase 4; §5.5/§5.6/§5.7 → Briefs E/C/F).
- [x] No TBD/placeholder steps; all code blocks complete.
- [x] Names consistent across tasks (`isDevtoolsExpected`, `configAxios`, `safeGetItem`, `isRefreshRequest`, `UseAbortControllerReturn`).
