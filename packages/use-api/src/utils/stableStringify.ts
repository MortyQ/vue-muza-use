/**
 * Deterministic JSON serialization used to build stable cache/dedup keys.
 *
 * Object keys are sorted lexicographically (recursively), so two structurally
 * equal objects with different key insertion order produce the same string.
 * Array order is preserved (it is semantically meaningful). Keys whose value is
 * `undefined` are omitted — matching how axios drops `undefined` params — while
 * `null` is kept. A top-level `null`/`undefined` serializes to an empty string.
 *
 * @example
 * ```ts
 * stableStringify({ b: 1, a: 2 })   // '{"a":2,"b":1}'
 * stableStringify([1, 2, 3])         // "[1,2,3]"
 * stableStringify(undefined)         // ""
 * ```
 */
export function stableStringify(value: unknown): string {
    if (value === undefined || value === null) return "";
    return serialize(value);
}

function serialize(value: unknown): string {
    if (value === null) return "null";
    if (typeof value !== "object") return JSON.stringify(value) ?? "null";

    if (Array.isArray(value)) {
        return `[${value.map((item) => (item === undefined ? "null" : serialize(item))).join(",")}]`;
    }

    const entries = Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<string[]>((acc, key) => {
            const v = (value as Record<string, unknown>)[key];
            if (v === undefined) return acc; // omit undefined keys
            acc.push(`${JSON.stringify(key)}:${serialize(v)}`);
            return acc;
        }, []);

    return `{${entries.join(",")}}`;
}
