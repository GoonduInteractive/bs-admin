/**
 * Deterministic randomness for fixtures. `Math.random` would hand the server
 * and the browser different data and break hydration; a seeded generator
 * gives both the same rows every time.
 */

export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    /** Pick by weight: `[["a", 3], ["b", 1]]` returns "a" three times as often. */
    weighted<T>(entries: readonly (readonly [T, number])[]): T {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
  };
}

/**
 * The fixtures' "today". Fixed, so dummy data does not drift between renders
 * or between days. Swap for `new Date()` once real data arrives.
 */
export const MOCK_NOW = new Date("2026-09-24T12:00:00+01:00").getTime();

export const DAY = 86_400_000;

export function daysAgo(days: number, hour = 12, minute = 0): string {
  const d = new Date(MOCK_NOW - days * DAY);
  d.setUTCHours(hour - 1, minute, 0, 0); // hour is Lagos time (UTC+1)
  return d.toISOString();
}

export function daysFromNow(days: number, hour = 18): string {
  return daysAgo(-days, hour);
}
