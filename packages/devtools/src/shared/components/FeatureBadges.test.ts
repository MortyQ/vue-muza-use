import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import type { DevtoolsInstanceOptions } from "../types/index";
import FeatureBadges from "./FeatureBadges.vue";

function makeOptions(over: Partial<DevtoolsInstanceOptions> = {}): DevtoolsInstanceOptions {
    return {
        authMode: "default",
        cache: null,
        retry: false,
        poll: 0,
        immediate: true,
        lazy: false,
        ...over,
    };
}

function badgeTexts(options: DevtoolsInstanceOptions): string[] {
    const w = mount(FeatureBadges, { props: { options } });
    return w.findAll(".badge").map((b) => b.text());
}

describe("FeatureBadges — cache / swr merging", () => {
    it("renders nothing when no features are active", () => {
        const w = mount(FeatureBadges, { props: { options: makeOptions() } });
        expect(w.find(".feature-badges").exists()).toBe(false);
    });

    it("shows cache·auto for cache without swr and without id", () => {
        const texts = badgeTexts(makeOptions({
            cache: { staleTime: 300_000, swr: false, freshFor: 0 },
        }));
        expect(texts).toEqual(["cache·auto"]);
    });

    it("shows cache·<id> for a manual cache key without swr", () => {
        const texts = badgeTexts(makeOptions({
            cache: { id: "products", staleTime: 300_000, swr: false, freshFor: 0 },
        }));
        expect(texts).toEqual(["cache·products"]);
    });

    it("merges cache + swr into a single swr·auto chip", () => {
        const texts = badgeTexts(makeOptions({
            cache: { staleTime: 300_000, swr: true, freshFor: 0 },
        }));
        expect(texts).toEqual(["swr·auto"]);
    });

    it("merges cache + swr with a manual key into swr·<id>", () => {
        const texts = badgeTexts(makeOptions({
            cache: { id: "products", staleTime: 300_000, swr: true, freshFor: 0 },
        }));
        expect(texts).toEqual(["swr·products"]);
    });

    it("truncates a long cache id to 12 characters with an ellipsis", () => {
        const texts = badgeTexts(makeOptions({
            cache: { id: "products-catalog-page-2", staleTime: 300_000, swr: true, freshFor: 0 },
        }));
        expect(texts).toEqual(["swr·products-cat…"]);
    });
});

describe("FeatureBadges — lazy", () => {
    it("shows the lazy chip only when lazy is explicitly true", () => {
        const texts = badgeTexts(makeOptions({ lazy: true }));
        expect(texts).toEqual(["lazy"]);
    });

    it("does not show lazy for immediate: false without the lazy flag", () => {
        const w = mount(FeatureBadges, {
            props: { options: makeOptions({ immediate: false, lazy: false }) },
        });
        expect(w.find(".feature-badges").exists()).toBe(false);
    });
});

describe("FeatureBadges — behavior chips", () => {
    it("renders polling, retry, batch and debounce chips when active", () => {
        const texts = badgeTexts(makeOptions({
            poll: 5000,
            retry: 3,
            batch: true,
            debounce: 300,
        }));
        expect(texts).toEqual(["polling", "retry", "batch", "debounce"]);
    });
});
