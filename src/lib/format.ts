/**
 * Display formatting. Data stays as integers and ISO strings everywhere else;
 * this is the one place it becomes text. Everything is pinned to en-NG and
 * Africa/Lagos so the server render and the browser render agree.
 */

const LOCALE = "en-NG";
const TZ = "Africa/Lagos";

const naira = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const nairaCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const count = new Intl.NumberFormat(LOCALE);
const countCompact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

/** ₦85,000 */
export function formatNaira(amount: number): string {
  return naira.format(amount);
}

/** ₦10.6M - for stat tiles and chart axes. */
export function formatNairaCompact(amount: number): string {
  return nairaCompact.format(amount);
}

export function formatCount(n: number): string {
  return count.format(n);
}

export function formatCountCompact(n: number): string {
  return countCompact.format(n);
}

const hbarWhole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const hbarCents = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1,500 HBAR · 17.31 HBAR · 12,558.20 HBAR. Two decimals at most: the admin never deals in tinybars. */
export function formatHbar(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${(Number.isInteger(rounded) ? hbarWhole : hbarCents).format(rounded)} HBAR`;
}

/** +8.4% / -2.1% */
export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/** A missing or unreadable date: shown as a dash, since formatting one throws. */
const missing = (iso: string) => !iso || Number.isNaN(Date.parse(iso));

/** Sep 15, 2026 */
export function formatDate(iso: string): string {
  if (missing(iso)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Sep 15, 2026, 4:30 PM */
export function formatDateTime(iso: string): string {
  if (missing(iso)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 4:30 PM */
export function formatTime(iso: string): string {
  if (missing(iso)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
