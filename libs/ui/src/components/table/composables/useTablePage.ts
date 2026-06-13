import { provide, ref, watch, type InjectionKey, type Ref, type WatchSource, triggerRef } from "vue";

/** Injection key used by VTable to sync page back to useTablePage ref */
export const TABLE_PAGE_KEY: InjectionKey<Ref<number>> = Symbol("tablePageKey");

/**
 * Composable for declarative table page management.
 * Works as a drop-in replacement for `ref(1)` with two extra capabilities:
 *
 * 1. Auto-resets to page 1 (flush: 'sync') when resetOn sources change —
 *    before useApiPost reads page.value, so requests always go with page: 1
 *    after a filter/period change.
 *
 * 2. Provides the page ref to a child VTable via inject, so VTable can sync
 *    page back on pagination clicks — no v-model:page needed.
 *
 * @example
 * import { VTable, useTablePage } from "@app/core";
 *
 * // Resets on filter change, VTable syncs clicks back automatically
 * const page = useTablePage([() => filterStore.tableFilters]);
 *
 * // With period select
 * const page = useTablePage([() => filterStore.tableFilters, periodState]);
 */
export function useTablePage(resetOn: WatchSource[] = []) {
  const page = ref(1);

  if (resetOn.length) {
    watch(resetOn, () => {
      if (page.value === 1) {
        triggerRef(page);
      }
      else {
        page.value = 1;
      }
    }, { flush: "pre", deep: true });
  }

  // Provide to child VTable — enables two-way sync without v-model:page
  provide(TABLE_PAGE_KEY, page);

  return page;
}
