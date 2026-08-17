/**
 * Header keys whose values carry credentials and must be masked before
 * leaving the library (devtools display, logs). Mirrors the field-name
 * heuristic of TOKEN_KEY_RE in devtools.ts, extended with cookie headers.
 */
const SENSITIVE_HEADER_RE = /token|jwt|bearer|secret|password|authoriz(e|ation)|api[_-]?key|session|cookie/i;

/** Keep enough of the value to recognize its shape, hide the credential. */
const VISIBLE_PREFIX_LENGTH = 12;

function maskHeaderValue(value: string): string {
    if (value.length <= VISIBLE_PREFIX_LENGTH) return "•••redacted•••";
    return `${value.slice(0, VISIBLE_PREFIX_LENGTH)}…[redacted]`;
}

const CONTENT_TYPE_KEY_RE = /^content-type$/i;

/** Whether the caller already declared a Content-Type for this request. */
function hasExplicitContentType(headers: unknown): boolean {
    if (headers === null || typeof headers !== "object") return false;
    return Object.keys(headers as Record<string, unknown>).some((key) => CONTENT_TYPE_KEY_RE.test(key));
}

/**
 * The Content-Type a non-JSON request body needs, or `undefined` when the
 * request should be left alone.
 *
 * The Axios client created by `createApiClient` defaults every request to
 * `application/json`. For a `FormData` body that default is destructive rather
 * than merely wrong: Axios's `transformRequest` sees a JSON content type and
 * replaces the form with `JSON.stringify(formDataToJSON(data))`, so uploaded
 * files reach the server as `{"type":"","name":"blob"}` metadata and the request
 * still succeeds. A `URLSearchParams` body survives, but goes out url-encoded
 * while labelled JSON.
 *
 * An explicitly provided Content-Type always wins — including
 * `application/json` on a form, which is Axios's deliberate
 * form-to-JSON conversion feature.
 *
 * @example
 * ```ts
 * contentTypeForBody(new FormData(), undefined)                      // "multipart/form-data"
 * contentTypeForBody(new FormData(), { "Content-Type": "text/csv" }) // undefined — caller decided
 * contentTypeForBody({ a: 1 }, undefined)                            // undefined — JSON default is right
 * ```
 */
export function contentTypeForBody(data: unknown, headers: unknown): string | undefined {
    if (data === null || data === undefined) return undefined;
    if (hasExplicitContentType(headers)) return undefined;
    // typeof guards keep this safe in non-browser runtimes
    if (typeof FormData !== "undefined" && data instanceof FormData) return "multipart/form-data";
    if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
        return "application/x-www-form-urlencoded";
    }
    return undefined;
}

/**
 * Normalize an Axios headers object (AxiosHeaders instance or plain object)
 * into a plain `Record<string, string>` suitable for devtools display.
 *
 * - `AxiosHeaders` is unwrapped via its `toJSON()`
 * - non-string values (e.g. `set-cookie` arrays, numbers) are coerced
 * - `null`/`undefined` entries are skipped
 * - credential-bearing headers (Authorization, Cookie, X-Api-Key, …) are masked,
 *   e.g. `Bearer eyJab…[redacted]`
 *
 * Returns `undefined` when the input is absent or has no entries, so callers
 * can spread the field conditionally.
 */
export function normalizeHeaders(headers: unknown): Record<string, string> | undefined {
    if (headers === null || typeof headers !== "object") return undefined;

    const source: Record<string, unknown> = typeof (headers as { toJSON?: unknown }).toJSON === "function"
        ? (headers as { toJSON: () => Record<string, unknown> }).toJSON()
        : (headers as Record<string, unknown>);

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
        if (value === null || value === undefined) continue;
        const str = Array.isArray(value) ? value.join(", ") : String(value);
        result[key] = SENSITIVE_HEADER_RE.test(key) ? maskHeaderValue(str) : str;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}
