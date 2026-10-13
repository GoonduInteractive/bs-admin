/**
 * `<input type="datetime-local">` speaks wall-clock time with no zone. The
 * admin schedules in Lagos time (UTC+1, no daylight saving), so these convert
 * between that and ISO instants regardless of the browser's or server's zone.
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** ISO instant -> "2026-10-08T10:00" in Lagos. */
export function toLagosInput(iso?: string): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
}

/** "2026-10-08T10:00" in Lagos -> ISO instant. */
export function fromLagosInput(local: string): string {
  return new Date(`${local}:00+01:00`).toISOString();
}

/** "2026-10-08" in Lagos, for <input type="date">. */
export function toLagosDate(iso?: string): string {
  return toLagosInput(iso).slice(0, 10);
}
