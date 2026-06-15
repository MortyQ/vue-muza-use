/**
 * Parses query parameters from a URL string.
 * Returns a key→value record, or null if the URL has no query string or all params are empty.
 *
 * @example
 * ```ts
 * parseUrlQueryParams("/lists?q=hello&page=1")
 * // → { q: "hello", page: "1" }
 *
 * parseUrlQueryParams("/lists")
 * // → null
 * ```
 */
export function parseUrlQueryParams(url: string | undefined): Record<string, string> | null {
    if (!url) return null;
    const qIndex = url.indexOf("?");
    if (qIndex === -1) return null;
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(url.slice(qIndex + 1))) {
        params[k] = v;
    }
    return Object.keys(params).length > 0 ? params : null;
}
