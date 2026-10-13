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

/** +8.4% / -2.1% */
export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/** Sep 15, 2026 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Sep 15, 2026, 4:30 PM */
export function formatDateTime(iso: string): string {
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
