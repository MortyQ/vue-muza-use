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
