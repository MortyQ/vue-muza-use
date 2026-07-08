/** Round to 1 decimal and drop a trailing ".0" — 1.5 → "1.5", 2.0 → "2". */
function trim(n: number): string {
    const rounded = Math.round(n * 10) / 10;
    return String(rounded % 1 === 0 ? Math.trunc(rounded) : rounded);
}

/**
 * Compact single-unit duration formatter for CONFIG values (e.g. staleTime, TTL).
 * Picks the largest sensible unit and rounds to one decimal place.
 *
 * @example
 * ```ts
 * formatDuration(300_000); // "5m"
 * formatDuration(5_400_000); // "1.5h"
 * formatDuration(Infinity); // "∞"
 * ```
 */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) return "∞";
    if (ms < 1_000) return `${ms}ms`;
    const s = ms / 1_000;
    if (s < 60) return `${trim(s)}s`;
    const m = s / 60;
    if (m < 60) return `${trim(m)}m`;
    const h = m / 60;
    if (h < 24) return `${trim(h)}h`;
    return `${trim(h / 24)}d`;
}

/**
 * Two-unit countdown formatter for LIVE remaining time (e.g. time until cache expiry).
 * Clamps negative values to "0s".
 *
 * @example
 * ```ts
 * formatRemaining(292_000); // "4m 52s"
 * formatRemaining(-5); // "0s"
 * ```
 */
export function formatRemaining(ms: number): string {
    if (!Number.isFinite(ms)) return "∞";
    const totalS = Math.max(0, Math.floor(ms / 1_000));
    const d = Math.floor(totalS / 86_400);
    const h = Math.floor((totalS % 86_400) / 3_600);
    const m = Math.floor((totalS % 3_600) / 60);
    const s = totalS % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
