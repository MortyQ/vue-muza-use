import { addRequest, updateRequest } from "../store/devtoolsStore";
import type { RequestRecord, RequestEndResult } from "../types/index";

/**
 * Called when an HTTP request begins. Adds the record to the store's circular buffer.
 */
export function onRequestStart(
    record: Omit<RequestRecord, "duration" | "response" | "error" | "truncated">,
): void {
    addRequest(record);
}

/**
 * Called when an HTTP request completes (success, error, or abort). Updates the record in the store.
 */
export function onRequestEnd(id: string, result: RequestEndResult): void {
    updateRequest(id, result);
}
