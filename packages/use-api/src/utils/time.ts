import type { DurationInput } from "../types";

const DURATION_RE = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;

const UNIT_MS = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
} as const;

/**
 * Parse a {@link DurationInput} into milliseconds.
 * Numbers pass through unchanged; strings like `"30s"`, `"5m"`, `"1.5h"`, `"1d"` are converted.
 *
 * Malformed strings are unreachable through the `DurationString` type — the runtime
 * throw is a fail-fast guard for values cast past the type system.
 *
 * @example
 * ```ts
 * parseDuration(1500)   // 1500
 * parseDuration("5m")   // 300_000
 * parseDuration("1.5h") // 5_400_000
 * ```
 */
export function parseDuration(input: DurationInput): number {
    if (typeof input === "number") return input;
    const match = DURATION_RE.exec(input);
    if (!match) {
        throw new TypeError(`Invalid duration: "${input}" — expected a number or "<n><ms|s|m|h|d>" (e.g. "5m", "1.5h")`);
    }
    return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}
