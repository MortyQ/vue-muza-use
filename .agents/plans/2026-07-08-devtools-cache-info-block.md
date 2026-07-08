# Devtools Cache Info Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Cache" strip in the devtools request-detail panel showing the resolved cache key (copy key / copy prefix buttons), staleTime/freshFor config, and a live freshness countdown.

**Architecture:** use-api starts sending two new optional fields over the existing bridge — `cacheKey` on the request-start record and `cachedAt` on the success end-result (stamped when `writeCache` actually runs). The devtools panel mirrors the types, threads them through the store, and renders a new `CacheInfoBar.vue` between `DetailHeader` and `DetailTabs`. Countdown is computed client-side from `cachedAt + freshFor/staleTime − now` with a 1s ticker.

**Tech Stack:** Vue 3.5, TypeScript strict, Vitest + @vue/test-utils, tsup (use-api) / vite (devtools), pnpm workspace.

**Semver:** use-api `feat(devtools)` = minor (new optional fields on devtools types). Devtools panel: new UI feature.

**Design decisions (approved by user 2026-07-08):**
- Placement: always-visible strip under `DetailHeader` (NOT a tab) — the primary workflow is "quickly copy the prefix".
- Long keys: collapsed = single line CSS ellipsis (head of key visible); click to expand = `word-break: break-all` with `max-height` + inner scroll; copy buttons always copy the FULL value from state, never the rendered text.
- `copy prefix` only for auto keys; prefix reconstructed as `auto:${method.toUpperCase()}:${url}` from the record's own fields (never parsed out of the key — URLs may contain `:`).
- Countdown limitations (shown as a `title` tooltip): reflects the entry written by THIS request; manual `invalidateCache()` or overwrites by other instances are not tracked; fresh hits create no request record at all.
- No new bridge METHODS — only optional fields on existing payloads. `interceptors.ts` standalone refresh records compile unchanged (fields optional).

---

## Ground rules (project)

1. **NEVER commit without explicit user confirmation** (memory: `feedback_git_workflow.md`). Commit steps below are prepared; ask before each (or batch-confirm).
2. Run use-api tests: `pnpm --filter @ametie/vue-muza-use exec vitest run` (NOT `test --run`). Devtools tests: `pnpm --filter @ametie/vue-muza-devtools exec vitest run`.
3. Known pre-existing failures to IGNORE (exist on main): 3 tests in devtools `PayloadPane.test.ts`; 23 tsc errors in use-api (old test files); 1 tsc error in devtools `devtoolsStorage.test.ts` (`Array.at`, flaky in build output).
4. After editing `packages/devtools/src/shared/types/index.ts` you MUST run `pnpm --filter @ametie/vue-muza-devtools build`, otherwise use-api `tsc --noEmit` fails on the bridge type mismatch.
5. Style: 4-space indent, double quotes, semicolons; JSDoc on exported symbols; no `any`.
6. Current branch `feat/cashe-auto-key` — continue on it (user's call from the auto-keys feature).

---

### Task 1: use-api types — `cacheKey` on request record, `cachedAt` on success result

**Files:**
- Modify: `packages/use-api/src/types.ts` (~line 551 `DevtoolsRequestRecord`; `RequestEndResult` just below it)

- [ ] **Step 1: Add the fields**

In `DevtoolsRequestRecord` (types.ts:551), append after `queryParams`:

```ts
    /**
     * Resolved cache key for this request (auto-derived or manual id).
     * Null when caching is not active. Optional — standalone records
     * (e.g. token refresh) omit it.
     */
    cacheKey?: string | null;
```

In `RequestEndResult` (types.ts, the union right below), extend the success variant:

```ts
export type RequestEndResult =
    | { status: "success"; statusCode: number; response: unknown; duration: number; cachedAt?: number }
    | { status: "error"; error: ApiError; statusCode: number | null; duration: number }
    | { status: "aborted"; duration: number };
```

Add to the union's JSDoc: `cachedAt` — Unix ms timestamp of the moment the response was written to the cache; absent when caching was off for the request.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @ametie/vue-muza-use exec tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `23` (baseline, zero new).

---

### Task 2: use-api — send `cacheKey` and `cachedAt` over the bridge (TDD)

**Files:**
- Modify: `packages/use-api/src/useApi.ts` (onRequestStart call ~line 330; success branch ~line 375)
- Test: `packages/use-api/src/__tests__/useApi.devtools.test.ts` (append; READ IT FIRST and reuse its existing harness — it already has mocks and `__devtoolsInternals().setExpected(true)`-style setup from the devtools-gating work)

- [ ] **Step 1: Write the failing tests**

Append a describe block, adapting helper names to the file's actual ones (`clearAllCache()` in beforeEach — the cache is a module singleton):

```ts
describe("devtools — cache key and cachedAt propagation", () => {
    it("onRequestStart record carries the resolved cacheKey when cache is active", async () => {
        const startSpy = vi.spyOn(devtoolsBridge, "onRequestStart");
        // mount useApi("/test", { cache: true, params: { page: 1 } }) via the file's harness and execute
        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
            cacheKey: 'auto:GET:/test:{"page":1}:',
        }));
    });

    it("onRequestStart record carries cacheKey: null when caching is off", async () => {
        const startSpy = vi.spyOn(devtoolsBridge, "onRequestStart");
        // mount useApi("/test", {}) and execute
        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ cacheKey: null }));
    });

    it("onRequestEnd success result carries cachedAt when the response was cached", async () => {
        const endSpy = vi.spyOn(devtoolsBridge, "onRequestEnd");
        const before = Date.now();
        // mount useApi("/test", { cache: true }) and execute successfully
        const result = endSpy.mock.calls.at(-1)![1];
        expect(result.status).toBe("success");
        expect((result as { cachedAt?: number }).cachedAt).toBeGreaterThanOrEqual(before);
    });

    it("onRequestEnd success result has NO cachedAt when caching is off", async () => {
        const endSpy = vi.spyOn(devtoolsBridge, "onRequestEnd");
        // mount useApi("/test", {}) and execute successfully
        const result = endSpy.mock.calls.at(-1)![1];
        expect(result).not.toHaveProperty("cachedAt");
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run src/__tests__/useApi.devtools.test.ts`
Expected: FAIL — records have no `cacheKey` property, results have no `cachedAt`.

- [ ] **Step 3: Implement in `useApi.ts`**

(a) In `executeRequest`, the `key` const is already computed BEFORE the try block (auto-keys feature). In the `devtoolsBridge.onRequestStart({ ... })` call (~line 330), add one field:

```ts
                queryParams: devtoolsQueryParams,
                cacheKey: key,
```

(b) In the success branch, stamp the write moment. Replace:

```ts
                    // Cache WRITE — only on 2xx success; always store raw data
                    if (cacheOpts && key !== null) {
                        writeCache(key, response.data, cacheOpts.staleTime);
                    }
```

with:

```ts
                    // Cache WRITE — only on 2xx success; always store raw data
                    let cacheWrittenAt: number | undefined;
                    if (cacheOpts && key !== null) {
                        writeCache(key, response.data, cacheOpts.staleTime);
                        cacheWrittenAt = Date.now();
                    }
```

and extend the success end-result (~line 375):

```ts
                    devtoolsRequestEndResult = {
                        status: "success",
                        statusCode: response.status,
                        response: response.data,
                        duration: Date.now() - devtoolsRequestStartedAt,
                        cachedAt: cacheWrittenAt,
                    };
```

(`cachedAt: undefined` serializes away in the store spread; the "no cachedAt" test passes because `expect.not.toHaveProperty` treats an explicit `undefined` as present — if that assertion is strict, build the object conditionally instead: `...(cacheWrittenAt !== undefined ? { cachedAt: cacheWrittenAt } : {})`. Use the conditional spread form — it is the honest shape.)

- [ ] **Step 4: Run target + full suite**

Run: `pnpm --filter @ametie/vue-muza-use exec vitest run`
Expected: all green (baseline 555 passed / 22 todo + 4 new).

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/use-api/src/types.ts packages/use-api/src/useApi.ts packages/use-api/src/__tests__/useApi.devtools.test.ts
git commit -m "feat(devtools): send resolved cacheKey and cachedAt over the devtools bridge"
```

---

### Task 3: devtools types mirror + store threading (TDD)

**Files:**
- Modify: `packages/devtools/src/shared/types/index.ts` (`RequestRecord` ~line 72; `RequestEndResult` ~line 96)
- Modify: `packages/devtools/src/shared/store/devtoolsStore.ts` (`addRequest` Omit ~line 99; `updateRequest` success branch ~line 138)
- Test: `packages/devtools/src/shared/store/devtoolsStore.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `devtoolsStore.test.ts` (reuse its existing fixture style — note its instance fixtures use `cache: undefined`):

```ts
describe("cache metadata threading", () => {
    it("addRequest preserves cacheKey on the stored record", () => {
        addRequest({
            id: "r-ck", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null,
            cacheKey: 'auto:GET:/lists:{"page":1}:',
        });
        const rec = requests.value.find((r) => r.id === "r-ck")!;
        expect(rec.cacheKey).toBe('auto:GET:/lists:{"page":1}:');
    });

    it("updateRequest merges cachedAt from a success result", () => {
        addRequest({
            id: "r-ca", instanceId: null, url: "/lists", method: "GET",
            startedAt: 1000, status: "pending", statusCode: null,
            requestHeaders: {}, payload: null, queryParams: null, cacheKey: "manual",
        });
        updateRequest("r-ca", { status: "success", statusCode: 200, response: {}, duration: 40, cachedAt: 1234567 });
        const rec = requests.value.find((r) => r.id === "r-ca")!;
        expect(rec.cachedAt).toBe(1234567);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/shared/store/devtoolsStore.test.ts`
Expected: FAIL — `cacheKey`/`cachedAt` do not exist on the types / are dropped.

- [ ] **Step 3: Mirror the types**

In `packages/devtools/src/shared/types/index.ts`, `RequestRecord` (append after `instanceOptions`):

```ts
    /** Resolved cache key for this request; null when caching inactive; undefined for standalone records. Mirrors use-api. */
    cacheKey?: string | null;
    /** Unix ms timestamp when the response was written to the cache; absent if caching was off. Mirrors use-api. */
    cachedAt?: number;
```

`RequestEndResult` success variant:

```ts
    | { status: "success"; statusCode: number; response: unknown; duration: number; cachedAt?: number }
```

- [ ] **Step 4: Thread through the store**

In `devtoolsStore.ts`:
(a) `addRequest` — add `"cachedAt"` to the Omit list (it is set at request END, not start; `cacheKey` stays in the partial and flows via `...partial`):

```ts
    partial: Omit<RequestRecord, "duration" | "response" | "error" | "truncated" | "instanceOptions" | "cachedAt">,
```

(b) `updateRequest` success branch — add `cachedAt` to the merged record:

```ts
        state.requests[idx] = {
            ...record,
            status: "success",
            statusCode: result.statusCode,
            response: truncatedResponse,
            duration: result.duration,
            cachedAt: result.cachedAt,
            truncated: record.truncated || truncated,
        };
```

- [ ] **Step 5: Run devtools store tests + rebuild**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/shared/store/devtoolsStore.test.ts` → PASS.
Run: `pnpm --filter @ametie/vue-muza-devtools build` → success.
Run: `pnpm --filter @ametie/vue-muza-use exec tsc --noEmit 2>&1 | grep -c "error TS"` → `23` (baseline).

- [ ] **Step 6: Commit (after user confirmation)**

```bash
git add packages/devtools/src/shared/types/index.ts packages/devtools/src/shared/store/devtoolsStore.ts packages/devtools/src/shared/store/devtoolsStore.test.ts
git commit -m "feat(devtools-panel): thread cacheKey and cachedAt through record types and store"
```

---

### Task 4: devtools — duration formatters (TDD)

**Files:**
- Create: `packages/devtools/src/shared/utils/formatDuration.ts`
- Test: `packages/devtools/src/shared/utils/formatDuration.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { formatDuration, formatRemaining } from "./formatDuration";

describe("formatDuration (config values)", () => {
    it("formats sub-second as ms", () => expect(formatDuration(500)).toBe("500ms"));
    it("formats seconds", () => expect(formatDuration(30_000)).toBe("30s"));
    it("formats minutes", () => expect(formatDuration(300_000)).toBe("5m"));
    it("formats fractional hours", () => expect(formatDuration(5_400_000)).toBe("1.5h"));
    it("formats days", () => expect(formatDuration(86_400_000)).toBe("1d"));
    it("formats Infinity", () => expect(formatDuration(Infinity)).toBe("∞"));
    it("formats zero", () => expect(formatDuration(0)).toBe("0ms"));
});

describe("formatRemaining (countdown values)", () => {
    it("seconds only", () => expect(formatRemaining(7_000)).toBe("7s"));
    it("minutes and seconds", () => expect(formatRemaining(292_000)).toBe("4m 52s"));
    it("hours and minutes", () => expect(formatRemaining(3_720_000)).toBe("1h 2m"));
    it("days and hours", () => expect(formatRemaining(90_000_000)).toBe("1d 1h"));
    it("clamps negatives to 0s", () => expect(formatRemaining(-5)).toBe("0s"));
    it("Infinity", () => expect(formatRemaining(Infinity)).toBe("∞"));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/shared/utils/formatDuration.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
/** Round to 1 decimal and drop a trailing ".0" — 1.5 → "1.5", 2.0 → "2". */
function trim(n: number): string {
    const rounded = Math.round(n * 10) / 10;
    return String(rounded % 1 === 0 ? Math.trunc(rounded) : rounded);
}

/**
 * Compact single-unit duration for CONFIG values: 300000 → "5m", 5400000 → "1.5h".
 */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) return "∞";
    if (ms < 1_000) return `${ms}ms`;
    const s = ms / 1_000;
    if (s < 60) return `${trim(s)}s`;
    const m = s / 60;
    if (m < 60) return `${trim(m)}m`;
    const h = m / 60;
    if (h < 24) return `${trim(h)}h`;
    return `${trim(h / 24)}d`;
}

/**
 * Two-unit countdown for LIVE remaining time: 292000 → "4m 52s". Clamps at 0.
 */
export function formatRemaining(ms: number): string {
    if (!Number.isFinite(ms)) return "∞";
    const totalS = Math.max(0, Math.floor(ms / 1_000));
    const d = Math.floor(totalS / 86_400);
    const h = Math.floor((totalS % 86_400) / 3_600);
    const m = Math.floor((totalS % 3_600) / 60);
    const s = totalS % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/shared/utils/formatDuration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/devtools/src/shared/utils/formatDuration.ts packages/devtools/src/shared/utils/formatDuration.test.ts
git commit -m "feat(devtools-panel): add duration/countdown formatters"
```

---

### Task 5: devtools — `CacheInfoBar.vue` component (TDD)

**Files:**
- Create: `packages/devtools/src/features/network/components/CacheInfoBar.vue`
- Test: `packages/devtools/src/features/network/components/CacheInfoBar.test.ts`

- [ ] **Step 1: Write the failing tests**

Follow the mount style of the existing `PayloadPane.test.ts` (same folder). Use `vi.useFakeTimers()` for the countdown.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import CacheInfoBar from "./CacheInfoBar.vue";
import type { RequestRecord } from "../../../shared/types/index";

function makeRequest(over: Partial<RequestRecord> = {}): RequestRecord {
    return {
        id: "r1", instanceId: "i1", url: "/lists", method: "GET",
        startedAt: 1_000, duration: 40, status: "success", statusCode: 200,
        requestHeaders: {}, payload: null, queryParams: null, response: null,
        error: null, truncated: false, instanceOptions: undefined,
        cacheKey: 'auto:GET:/lists:{"page":1}:', cachedAt: Date.now(),
        ...over,
    };
}

const cache = { staleTime: 300_000, swr: true, freshFor: 10_000 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CacheInfoBar — key row", () => {
    it("renders the full cache key text", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.text()).toContain('auto:GET:/lists:{"page":1}:');
    });

    it("shows a prefix copy button for auto keys", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.find('[data-test="copy-prefix"]').exists()).toBe(true);
    });

    it("hides the prefix button for manual keys", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cacheKey: "my-manual-id" }), cache } });
        expect(w.find('[data-test="copy-prefix"]').exists()).toBe(false);
    });

    it("toggles the expanded class on key click", async () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        await w.find('[data-test="key-text"]').trigger("click");
        expect(w.find('[data-test="key-text"]').classes()).toContain("expanded");
    });
});

describe("CacheInfoBar — config row", () => {
    it("renders humanized staleTime and freshFor", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        expect(w.text()).toContain("staleTime 5m");
        expect(w.text()).toContain("freshFor 10s");
        expect(w.text()).toContain("swr");
    });
});

describe("CacheInfoBar — countdown", () => {
    it("shows fresh state with remaining time inside the freshFor window", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 3_000 }), cache } });
        expect(w.text()).toMatch(/fresh/i);
        expect(w.text()).toContain("7s");
    });

    it("shows the swr window after freshFor elapses", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 20_000 }), cache } });
        expect(w.text()).toMatch(/stale in/i);
    });

    it("shows expired after staleTime elapses", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 400_000 }), cache } });
        expect(w.text()).toMatch(/expired/i);
    });

    it("ticks: fresh flips to the swr window as time advances", async () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: Date.now() - 9_500 }), cache } });
        expect(w.text()).toMatch(/fresh/i);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(w.text()).toMatch(/stale in/i);
    });

    it("renders no countdown when cachedAt is absent", () => {
        const w = mount(CacheInfoBar, { props: { request: makeRequest({ cachedAt: undefined }), cache } });
        expect(w.find('[data-test="countdown"]').exists()).toBe(false);
    });

    it("clears its interval on unmount", () => {
        const clearSpy = vi.spyOn(globalThis, "clearInterval");
        const w = mount(CacheInfoBar, { props: { request: makeRequest(), cache } });
        w.unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/features/network/components/CacheInfoBar.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `CacheInfoBar.vue`**

```vue
<!-- Cache details strip for the request detail view: resolved key with copy
     actions, humanized config, and a live freshness countdown. -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { RequestRecord, DevtoolsResolvedCache } from "../../../shared/types/index";
import { formatDuration, formatRemaining } from "../../../shared/utils/formatDuration";
import CopyButton from "../../../shared/components/CopyButton.vue";

const props = defineProps<{ request: RequestRecord; cache: NonNullable<DevtoolsResolvedCache> }>();

const expanded = ref(false);

const isAutoKey = computed(() => props.request.cacheKey?.startsWith("auto:") ?? false);

// Reconstructed from the record's own fields (matches resolveCacheKey in use-api);
// never parsed out of the key — URLs may legally contain ":".
const prefix = computed(() => `auto:${props.request.method.toUpperCase()}:${props.request.url}`);

// 1s ticker drives the countdown; runs only while the bar is mounted.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1_000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

type Freshness = { state: "fresh" | "swr" | "cached" | "expired"; remaining: number };

const freshness = computed<Freshness | null>(() => {
    const cachedAt = props.request.cachedAt;
    if (cachedAt === undefined) return null;
    const age = now.value - cachedAt;
    if (props.cache.swr && age < props.cache.freshFor) {
        return { state: "fresh", remaining: props.cache.freshFor - age };
    }
    if (age < props.cache.staleTime) {
        return { state: props.cache.swr ? "swr" : "cached", remaining: props.cache.staleTime - age };
    }
    return { state: "expired", remaining: 0 };
});

const countdownLabel = computed(() => {
    const f = freshness.value;
    if (!f) return "";
    switch (f.state) {
        case "fresh": return `fresh — ${formatRemaining(f.remaining)} left`;
        case "swr": return `revalidates on hit — stale in ${formatRemaining(f.remaining)}`;
        case "cached": return `cached — expires in ${formatRemaining(f.remaining)}`;
        case "expired": return "expired";
    }
});

const COUNTDOWN_TOOLTIP =
    "Freshness of the entry written by this request. Manual invalidateCache() calls "
    + "and overwrites by other instances with the same key are not tracked.";
</script>

<template>
    <div class="cache-info">
        <div v-if="request.cacheKey" class="cache-info__row">
            <span class="cache-info__label">key</span>
            <span
                class="cache-info__key"
                :class="{ expanded }"
                data-test="key-text"
                @click="expanded = !expanded"
            >{{ request.cacheKey }}</span>
            <CopyButton :value="request.cacheKey" data-test="copy-key" />
            <template v-if="isAutoKey">
                <span class="cache-info__sep">·</span>
                <span class="cache-info__prefix-label">prefix</span>
                <CopyButton :value="prefix" data-test="copy-prefix" />
            </template>
        </div>
        <div class="cache-info__row">
            <span class="cache-info__label">config</span>
            <span class="cache-info__config">
                staleTime {{ formatDuration(cache.staleTime) }}
                <span class="cache-info__sep">·</span>
                freshFor {{ formatDuration(cache.freshFor) }}
                <template v-if="cache.swr"><span class="cache-info__sep">·</span>swr</template>
            </span>
            <span
                v-if="freshness"
                class="cache-info__countdown"
                :class="`cache-info__countdown--${freshness.state}`"
                data-test="countdown"
                :title="COUNTDOWN_TOOLTIP"
            >{{ countdownLabel }}</span>
        </div>
    </div>
</template>

<style scoped>
.cache-info {
    padding: 6px 12px;
    background: var(--dt-surface);
    border-bottom: 1px solid var(--dt-border-subtle);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
}
.cache-info__row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.cache-info__label {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dt-foreground-subtle);
    width: 42px;
}
.cache-info__key {
    font-family: "SF Mono", "Fira Code", Consolas, monospace;
    color: oklch(68% 0.18 200);
    cursor: pointer;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cache-info__key.expanded {
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 72px;
    overflow-y: auto;
}
.cache-info__key.expanded::-webkit-scrollbar { width: 4px; }
.cache-info__key.expanded::-webkit-scrollbar-thumb { background: var(--dt-border-strong); border-radius: 2px; }
.cache-info__prefix-label { color: var(--dt-foreground-muted); }
.cache-info__sep { color: var(--dt-foreground-subtle); }
.cache-info__config { color: var(--dt-foreground-secondary); white-space: nowrap; }
.cache-info__countdown { margin-left: auto; white-space: nowrap; flex-shrink: 0; }
.cache-info__countdown--fresh   { color: oklch(72% 0.17 160); }
.cache-info__countdown--swr     { color: oklch(72% 0.17 65); }
.cache-info__countdown--cached  { color: oklch(68% 0.18 200); }
.cache-info__countdown--expired { color: var(--dt-foreground-subtle); }
</style>
```

Note for the executor: `CopyButton` renders `{{ copied ? "✓" : "copy" }}` and takes `value: string` — `data-test` lands on its root button via attribute fallthrough.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run src/features/network/components/CacheInfoBar.test.ts`
Expected: PASS. If the countdown tick test is flaky, ensure `advanceTimersByTimeAsync` is used (component updates need a microtask flush).

- [ ] **Step 5: Commit (after user confirmation)**

```bash
git add packages/devtools/src/features/network/components/CacheInfoBar.vue packages/devtools/src/features/network/components/CacheInfoBar.test.ts
git commit -m "feat(devtools-panel): add CacheInfoBar with key copy, prefix copy, and freshness countdown"
```

---

### Task 6: mount the bar in `RequestDetail.vue`

**Files:**
- Modify: `packages/devtools/src/features/network/components/RequestDetail.vue`

- [ ] **Step 1: Insert the component**

Add the import:

```ts
import CacheInfoBar from "./CacheInfoBar.vue";
```

In the template, between `DetailHeader` and `DetailTabs`:

```vue
        <DetailHeader :request="request" :instance-options="instanceOptions" @close="$emit('close')" />
        <CacheInfoBar
            v-if="instanceOptions?.cache"
            :request="request"
            :cache="instanceOptions.cache"
        />
        <DetailTabs :active-tab="activeTab" :has-error="!!request.error" @select="activeTab = $event" />
```

(`instanceOptions.cache` is the resolved `DevtoolsResolvedCache` — truthy only when caching is active for the instance; standalone records like token refresh have `instanceOptions: undefined`, so the bar never renders for them.)

- [ ] **Step 2: Full devtools suite + build**

Run: `pnpm --filter @ametie/vue-muza-devtools exec vitest run`
Expected: only the 3 known pre-existing `PayloadPane.test.ts` failures; everything else green.
Run: `pnpm --filter @ametie/vue-muza-devtools build` → success.

- [ ] **Step 3: Commit (after user confirmation)**

```bash
git add packages/devtools/src/features/network/components/RequestDetail.vue
git commit -m "feat(devtools-panel): show cache info strip in request detail"
```

---

### Task 7: cross-package verification + manual playground check

- [ ] **Step 1: Full verification matrix**

```bash
pnpm --filter @ametie/vue-muza-use build
pnpm --filter @ametie/vue-muza-devtools build
pnpm --filter @ametie/vue-muza-use exec vitest run          # expect 559+ passed / 22 todo
pnpm --filter @ametie/vue-muza-use exec tsc --noEmit        # expect 23 baseline errors
pnpm --filter @ametie/vue-muza-devtools exec vitest run      # expect only 3 known PayloadPane failures
```

- [ ] **Step 2: Manual verification (user drives, playground)**

`cd packages/playground && pnpm dev`, open the Auto Cache Keys page, open devtools panel → Network → select the `/lists` request:
1. Cache strip visible under the header; key row shows `auto:GET:/lists:...` truncated to one line; click expands it with inner scroll.
2. `copy` puts the FULL key in the clipboard; `prefix` copies `auto:GET:/lists`.
3. Config row: `staleTime 5m · freshFor 10s · swr` (values from playground `cacheDefaults`).
4. Countdown ticks: `fresh — …s left` → after 10s flips to `revalidates on hit — stale in …` → amber.
5. A no-cache request (e.g. Basic Fetch without cache) shows NO strip; the token-refresh standalone record shows NO strip.

- [ ] **Step 3: Changelog**

Add to `CHANGELOG.md` under the current unreleased section (`Added` → DevTools Panel): cache info strip — resolved key with copy/prefix-copy, humanized staleTime/freshFor, live freshness countdown (requires `@ametie/vue-muza-use` ≥ this release for `cacheKey`/`cachedAt` bridge fields; older versions show config without key/countdown).

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add devtools cache info strip entry"
```

---

## Self-review (done at plan-writing time)

- [x] Spec coverage: key + copy (Task 2, 5), prefix copy (Task 5), staleTime/freshFor display (Task 5), live countdown (Tasks 2, 3, 5), long-key behavior (Task 5 CSS + tests), tooltip limitations (Task 5), placement strip (Task 6).
- [x] No placeholders; every code step shows the code.
- [x] Type consistency: `cacheKey?: string | null` and `cachedAt?: number` named identically across use-api types, devtools types, store, and component; `DevtoolsResolvedCache` reused for the `cache` prop.
- [x] Backward compat: all new fields optional; interceptors.ts standalone records compile untouched; old records without `cachedAt` render config without countdown (explicit test).
