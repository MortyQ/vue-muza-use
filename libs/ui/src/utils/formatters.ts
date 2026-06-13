type NumberFormatter = "default" | "compact" | "percent" | "decimal";

export function formatCurrency(
  value: unknown,
  code: string | { code?: string, decimals?: number } | undefined = "USD",
  decimals = 2,
): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? "");
  const codeStr = typeof code === "object" ? (code?.code ?? "USD") : (code ?? "USD");
  const dec = typeof code === "object" ? (code?.decimals ?? decimals) : decimals;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: codeStr,
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num);
}

export function formatPercentage(
  value: unknown,
  opts?: boolean | { decimals?: number, multiplier?: boolean },
): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? "");
  const decimals = opts && typeof opts === "object" ? (opts.decimals ?? 1) : 1;
  const multiplier = opts && typeof opts === "object" ? (opts.multiplier ?? false) : false;
  const v = multiplier ? num * 100 : num;
  return `${v.toFixed(decimals)}%`;
}

export function formatNumber(
  value: unknown,
  opts?: NumberFormatter | { type?: NumberFormatter, decimals?: number },
): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? "");
  const type = typeof opts === "string" ? opts : opts?.type ?? "default";
  const decimals = typeof opts === "object" && opts !== null ? opts.decimals : undefined;
  const formatOpts: Intl.NumberFormatOptions = {};
  if (type === "compact") formatOpts.notation = "compact";
  if (type === "percent") formatOpts.style = "percent";
  if (decimals !== undefined) {
    formatOpts.minimumFractionDigits = decimals;
    formatOpts.maximumFractionDigits = decimals;
  }
  return new Intl.NumberFormat(undefined, formatOpts).format(num);
}

export function formatDate(
  value: unknown,
  opts?: string | { format?: string, locale?: string },
): string {
  if (!value) return "";
  const format = typeof opts === "string" ? opts : (opts?.format ?? "short");
  const locale = typeof opts === "object" ? opts?.locale : undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  const dateOpts: Intl.DateTimeFormatOptions
    = format === "short"
      ? { year: "numeric", month: "2-digit", day: "2-digit" }
      : format === "long"
        ? { year: "numeric", month: "long", day: "numeric" }
        : format === "time"
          ? { hour: "2-digit", minute: "2-digit" }
          : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat(locale, dateOpts).format(d);
}

export function formatBoolean(
  value: unknown,
  opts?: string | { trueText?: string, falseText?: string, colored?: boolean },
): string {
  const trueText = typeof opts === "object" ? (opts?.trueText ?? "Yes") : "Yes";
  const falseText = typeof opts === "object" ? (opts?.falseText ?? "No") : "No";
  return value ? trueText : falseText;
}

export function formatFileSize(
  value: unknown,
  opts?: boolean | { decimals?: number },
): string {
  const bytes = Number(value);
  if (isNaN(bytes)) return String(value ?? "");
  if (bytes === 0) return "0 B";
  const decimals = typeof opts === "object" ? (opts?.decimals ?? 1) : 1;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${sizes[i]}`;
}
