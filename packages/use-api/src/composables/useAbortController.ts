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
  /**
     * Signal of the current controller.
     * Re-evaluates after abort() swaps in a new controller.
     */
  const signal = computed(() => {
    // Vue tracks a computed's dependencies by which reactive values it READS
    // during evaluation, not by what it returns. abortController itself is a
    // plain (non-reactive) module-level `let`, so reading it alone wouldn't
    // register a dependency — the computed would never re-run after abort().
    // abortCount IS a ref and increments on every abort(), so reading it here
    // (even though its value is otherwise unused) is what forces this computed
    // to re-evaluate and pick up the new controller's signal.
    void abortCount.value;
    return abortController.signal;
  });

  /**
     * Abort all pending requests and create new controller
     * Call this when global filters change
     */
  const abort = () => {
    // IMPORTANT: Increment count BEFORE aborting, so handlers see the new value
    abortCount.value++;
    abortController.abort();
    abortController = new AbortController();
  };

  /**
     * Get fresh signal (use this in API calls)
     * Returns the current AbortSignal
     */
  const getSignal = (): AbortSignal => {
    return abortController.signal;
  };

  /**
     * Check if error is an abort error (DOM AbortError or axios cancellation)
     */
  const isAbortError = (error: unknown): boolean => {
    return (error instanceof DOMException && error.name === "AbortError") || isCancel(error);
  };

  return {
    signal,
    abort,
    getSignal,
    isAbortError,
    abortCount: readonly(abortCount),
  };
}
