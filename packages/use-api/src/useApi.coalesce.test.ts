/**
 * useApi — `coalesce` option (default true).
 *
 * One reactive flush with N dep mutations must produce exactly ONE request
 * with the final getter values — regardless of watcher registration order.
 * Regression for the double-auto-request bug (filter change + page/sort
 * reset-watch fired two requests; the first was aborted but hit the server).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, ref, watch } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { AxiosInstance } from "axios";
import { useApi } from "./useApi";
import { createApi } from "./plugin";
import { clearAllCache, readCacheEntry } from "./features/cacheManager";
import type { ApiPluginOptions, UseApiOptions, UseApiReturn } from "./types";

interface LoggedRequest {
    data: Record<string, unknown>;
    aborted: boolean;
}

const requestLog: LoggedRequest[] = [];

const mockAxios = {
    request: vi.fn((cfg: { data: Record<string, unknown>; signal?: AbortSignal }) => {
        const entry: LoggedRequest = { data: cfg.data, aborted: false };
        requestLog.push(entry);
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => resolve({ data: { echo: cfg.data }, status: 200, headers: {}, config: {} }), 0);
            cfg.signal?.addEventListener("abort", () => {
                entry.aborted = true;
                clearTimeout(t);
                reject(Object.assign(new Error("canceled"), { isAxiosError: true, code: "ERR_CANCELED" }));
            });
        });
    }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

function mountScenario(opts: {
    userWatchFirst?: boolean;
    apiOptions?: Partial<UseApiOptions<unknown>>;
    pluginOptions?: Partial<ApiPluginOptions>;
    mutateInSetup?: boolean;
}) {
    const filters = ref({ search: "" });
    const page = ref(1);
    const sort = ref([{ field: "PERIOD_START", order: "desc" }]);
    let api!: UseApiReturn<unknown, unknown>;

    const Comp = defineComponent({
        setup() {
            const registerUserWatch = () => {
                watch(filters, () => {
                    sort.value = [{ field: "PERIOD_START", order: "desc" }];
                    page.value = 1;
                });
            };
            if (opts.userWatchFirst) registerUserWatch();
            api = useApi("/table", {
                method: "POST",
                data: () => ({ ...filters.value, limit: 10, page: page.value, sort: sort.value }),
                immediate: true,
                ...opts.apiOptions,
            });
            if (!opts.userWatchFirst) registerUserWatch();
            if (opts.mutateInSetup) page.value = 7;
            return () => null;
        },
    });
    const wrapper = mount(Comp, {
        global: { plugins: [createApi({ axios: mockAxios, ...opts.pluginOptions })] },
    });
    return { filters, page, sort, api, wrapper };
}

/** Drain microtasks + the mock's setTimeout(0) responses. */
async function settle(ms = 20) {
    await flushPromises();
    await new Promise((r) => setTimeout(r, ms));
    await flushPromises();
}

/** Mutate away from defaults, settle, and clear the log — next flush is the scenario under test. */
async function primed(scenario: ReturnType<typeof mountScenario>) {
    scenario.page.value = 3;
    scenario.sort.value = [{ field: "NAME", order: "asc" }];
    await settle();
    requestLog.length = 0;
    return scenario;
}

const FINAL_PAYLOAD = {
    search: "abc",
    limit: 10,
    page: 1,
    sort: [{ field: "PERIOD_START", order: "desc" }],
};

describe("useApi — coalesce (default true)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        requestLog.length = 0;
        clearAllCache();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("regression: one flush with filter change + reset-watch", () => {
        it("sends exactly one request with final values (composable registered first)", async () => {
            const s = await primed(mountScenario({}));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toEqual(FINAL_PAYLOAD);
            expect(requestLog[0].aborted).toBe(false);
            expect(s.api.data.value).toEqual({ echo: FINAL_PAYLOAD });
        });

        it("sends exactly one request with final values (user watch registered first)", async () => {
            const s = await primed(mountScenario({ userWatchFirst: true }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toEqual(FINAL_PAYLOAD);
        });

        it("coalesces a cascade of watchers mutating deps in one flush", async () => {
            const filters = ref({ search: "" });
            const page = ref(3);
            const sort = ref("NAME");
            const limit = ref(50);
            const wrapper = mount(defineComponent({
                setup() {
                    useApi("/cascade", {
                        method: "POST",
                        data: () => ({ q: filters.value.search, page: page.value, sort: sort.value, limit: limit.value }),
                        immediate: true,
                    });
                    watch(filters, () => { page.value = 1; });
                    watch(page, () => { sort.value = "DEFAULT"; });
                    watch(sort, () => { limit.value = 10; });
                    return () => null;
                },
            }), { global: { plugins: [createApi({ axios: mockAxios })] } });
            await settle();
            requestLog.length = 0;

            filters.value = { search: "x" };
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toEqual({ q: "x", page: 1, sort: "DEFAULT", limit: 10 });
            wrapper.unmount();
        });
    });

    describe("no over-coalescing", () => {
        it("mutations in separate ticks send separate requests", async () => {
            const s = await primed(mountScenario({}));
            s.page.value = 2;
            await settle();
            s.page.value = 4;
            await settle();
            expect(requestLog).toHaveLength(2);
            expect(requestLog[0].data).toMatchObject({ page: 2 });
            expect(requestLog[1].data).toMatchObject({ page: 4 });
        });
    });

    describe("escape hatches", () => {
        it("coalesce: false restores per-trigger behavior (2 requests, first aborted)", async () => {
            const s = await primed(mountScenario({ apiOptions: { coalesce: false } }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(2);
            expect(requestLog[0].aborted).toBe(true);
            expect(requestLog[1].data).toEqual(FINAL_PAYLOAD);
        });

        it("globalOptions.coalesce: false applies to all instances", async () => {
            const s = await primed(mountScenario({ pluginOptions: { globalOptions: { coalesce: false } } }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(2);
        });

        it("per-request coalesce: true overrides globalOptions: false", async () => {
            const s = await primed(mountScenario({
                pluginOptions: { globalOptions: { coalesce: false } },
                apiOptions: { coalesce: true },
            }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(1);
        });
    });

    describe("immediate: true", () => {
        it("fires exactly one initial request; loading is true synchronously at mount", async () => {
            const s = mountScenario({});
            expect(s.api.loading.value).toBe(true); // startLoading preset, unaffected by deferral
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(s.api.loading.value).toBe(false);
        });

        it("dep mutated during setup coalesces with the immediate request", async () => {
            const s = mountScenario({ mutateInSetup: true }); // page.value = 7 inside setup
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toMatchObject({ page: 7 });
        });
    });

    describe("integration with existing options", () => {
        it("debounce: same-flush storm + debounce still yields one request with final values", async () => {
            const s = await primed(mountScenario({ apiOptions: { debounce: 30 } }));
            s.filters.value = { search: "abc" };
            await settle(60);
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toEqual(FINAL_PAYLOAD);
        });

        it("cache: single write under the final auto-key only", async () => {
            const s = await primed(mountScenario({ apiOptions: { cache: true } }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(requestLog).toHaveLength(1);
            const key = s.api.cacheKey.value!;
            expect(key).toContain('"page":1');
            expect(readCacheEntry(key)).not.toBeNull();
        });

        it("dynamic poll config change + dep change in one flush → one request", async () => {
            const poll = ref(0);
            const page = ref(1);
            const wrapper = mount(defineComponent({
                setup() {
                    useApi("/polled", {
                        method: "POST",
                        data: () => ({ page: page.value }),
                        immediate: true,
                        poll,
                    });
                    return () => null;
                },
            }), { global: { plugins: [createApi({ axios: mockAxios })] } });
            await settle();
            requestLog.length = 0;

            poll.value = 60_000;
            page.value = 2;
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toEqual({ page: 2 });
            wrapper.unmount();
        });
    });

    describe("manual execute()", () => {
        it("dep mutation + manual execute() in one tick → exactly one request (the manual one)", async () => {
            // No reset-watch here on purpose: with one, a post-execute auto-refetch
            // would be legitimate (deps genuinely change after the manual call).
            const status = ref("draft");
            let api!: UseApiReturn<unknown, unknown>;
            const wrapper = mount(defineComponent({
                setup() {
                    api = useApi("/items", {
                        method: "POST",
                        data: () => ({ status: status.value }),
                        immediate: true,
                    });
                    return () => null;
                },
            }), { global: { plugins: [createApi({ axios: mockAxios })] } });
            await settle();
            requestLog.length = 0;

            status.value = "active";
            const promise = api.execute({ skipErrorNotification: true });
            await settle();

            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].aborted).toBe(false);
            expect(requestLog[0].data).toEqual({ status: "active" });
            await expect(promise).resolves.toEqual({ echo: { status: "active" } });
            wrapper.unmount();
        });

        it("auto-tracking still works after a manual execute()", async () => {
            const s = await primed(mountScenario({}));
            await s.api.execute();
            await settle();
            requestLog.length = 0;

            s.page.value = 9;
            await settle();
            expect(requestLog).toHaveLength(1);
            expect(requestLog[0].data).toMatchObject({ page: 9 });
        });
    });

    describe("cleanup", () => {
        it("unmount between trigger and scheduled send → no request", async () => {
            const s = await primed(mountScenario({}));
            s.filters.value = { search: "abc" };
            s.wrapper.unmount(); // same tick, before nextTick fires
            await settle();
            expect(requestLog).toHaveLength(0);
        });

        it("execute() after unmount does not resurrect auto-tracking", async () => {
            const s = await primed(mountScenario({ apiOptions: { coalesce: false } }));
            s.wrapper.unmount();
            requestLog.length = 0;

            await s.api.execute(); // manual call after dispose — allowed, but must not restart tracking
            await settle();
            expect(requestLog).toHaveLength(1); // the manual request itself

            requestLog.length = 0;
            s.page.value = 42; // dep change after unmount must NOT trigger anything
            await settle();
            expect(requestLog).toHaveLength(0);
        });
    });

    describe("dev warning (coalesce disabled)", () => {
        it("warns once when ≥2 auto-triggers fire in one tick in development", async () => {
            vi.stubEnv("NODE_ENV", "development");
            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const s = await primed(mountScenario({ apiOptions: { coalesce: false } }));
            warnSpy.mockClear();

            s.filters.value = { search: "abc" };
            await settle();
            s.filters.value = { search: "def" };
            await settle();

            const coalesceWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes("auto-triggered"));
            expect(coalesceWarnings).toHaveLength(1); // warns once per instance, not per occurrence
            warnSpy.mockRestore();
        });

        it("does not warn when coalesce is active (default)", async () => {
            vi.stubEnv("NODE_ENV", "development");
            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const s = await primed(mountScenario({}));
            s.filters.value = { search: "abc" };
            await settle();
            expect(warnSpy.mock.calls.filter((c) => String(c[0]).includes("auto-triggered"))).toHaveLength(0);
            warnSpy.mockRestore();
        });

        it("does not warn outside development", async () => {
            vi.stubEnv("NODE_ENV", "production");
            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const s = await primed(mountScenario({ apiOptions: { coalesce: false } }));
            s.filters.value = { search: "abc" };
            await settle();
            expect(warnSpy.mock.calls.filter((c) => String(c[0]).includes("auto-triggered"))).toHaveLength(0);
            warnSpy.mockRestore();
        });
    });
});
