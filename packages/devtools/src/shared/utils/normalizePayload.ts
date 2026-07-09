/**
 * Format a byte count as a human-readable size, e.g. `847 B`, `12.3 kB`, `1.2 MB`.
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function describeBinary(value: File | Blob): string {
    const type = value.type || "unknown";
    if (typeof File !== "undefined" && value instanceof File) {
        return `file "${value.name}" (${type}, ${formatBytes(value.size)})`;
    }
    return `blob (${type}, ${formatBytes(value.size)})`;
}

function normalizeFormData(form: FormData): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    form.forEach((entry, key) => {
        const normalized = typeof entry === "string" ? entry : describeBinary(entry);
        const existing = result[key];
        if (existing === undefined) {
            result[key] = normalized;
        } else if (Array.isArray(existing)) {
            existing.push(normalized);
        } else {
            result[key] = [existing, normalized];
        }
    });
    return result;
}

/**
 * Convert non-JSON-serializable request/response bodies into plain, displayable
 * data. `JSON.stringify` silently turns FormData/File/Blob into `{}`, so the
 * payload pane would show an empty object for file uploads.
 *
 * - FormData → plain object; File/Blob entries become descriptor strings like
 *   `file "a.png" (image/png, 12.3 kB)`; duplicate keys collect into an array
 * - top-level File/Blob → descriptor string
 * - URLSearchParams → plain object
 * - anything else is returned unchanged
 */
export function normalizePayload(value: unknown): unknown {
    if (typeof FormData !== "undefined" && value instanceof FormData) {
        return normalizeFormData(value);
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) {
        return describeBinary(value);
    }
    if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
        const result: Record<string, unknown> = {};
        value.forEach((entry, key) => {
            const existing = result[key];
            if (existing === undefined) {
                result[key] = entry;
            } else if (Array.isArray(existing)) {
                existing.push(entry);
            } else {
                result[key] = [existing, entry];
            }
        });
        return result;
    }
    return value;
}
