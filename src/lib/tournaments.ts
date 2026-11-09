import type { BracketRound, RoundKey, Stage, StageKey, Tournament } from "@/types";

/**
 * Tournament settings an admin types in. Slots are a number, or unlimited;
 * the prize pool is split across as many positions as the admin chooses.
 */

/* ---- Slots ------------------------------------------------------------- */

/** "214 / 256", or "214 registered" when slots are unlimited. */
export function slotsLabel(t: Pick<Tournament, "slots">): string {
  return t.slots.total === null ? `${t.slots.taken} registered` : `${t.slots.taken} / ${t.slots.total}`;
}

/** How full the tournament is, 0 to 100. Null when slots are unlimited: there is no "full". */
export function slotsFill(t: Pick<Tournament, "slots">): number | null {
  if (t.slots.total === null) return null;
  return t.slots.total ? Math.min(100, Math.round((t.slots.taken / t.slots.total) * 100)) : 100;
}

/* ---- Prizes ------------------------------------------------------------ */

/** The split a new tournament starts with. */
export const DEFAULT_PRIZE_SPLIT = [60, 25, 15];

/** Percentages may carry two decimals, so a total within a hundredth of 100 counts as 100. */
export const SPLIT_TOLERANCE = 0.01;

export function splitTotal(split: readonly number[]): number {
  return Math.round(split.reduce((s, p) => s + p, 0) * 100) / 100;
}

/**
 * Naira per position. Each share is rounded down and the leftover naira go
 * to the top positions, so the payouts always add up to the pool exactly.
 */
export function prizeAmounts(pool: number, split: readonly number[]): number[] {
  const total = split.reduce((s, p) => s + p, 0);
  if (!total || pool <= 0) return split.map(() => 0);
  const exact = split.map((p) => (pool * p) / total);
  const amounts = exact.map(Math.floor);
  let left = pool - amounts.reduce((s, a) => s + a, 0);
  for (let i = 0; left > 0 && i < amounts.length; i++, left--) amounts[i] += 1;
  return amounts;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "Winner takes all", "Top 3", "Top 6". */
export function splitSummary(split: readonly number[]): string {
  return split.length === 1 ? "Winner takes all" : `Top ${split.length} paid`;
}

/* ---- Stages and the bracket -------------------------------------------- */

/**
 * The Journey, in order. More than QUALIFY_CUT players play Qualifiers - a
 * leaderboard, not a bracket - and the top 32 go into the Group stage (the
 * 32-player round), then Round of 16, Quarter-finals, Semi-finals, Final.
 * 32 or fewer skip Qualifiers and start at the smallest round that fits them.
 */
export const STAGE_ORDER: StageKey[] = ["registration", "qualifiers", "groupStage", "roundOf16", "quarterFinals", "semiFinals", "finals"];

/** Above this many players, a tournament opens with Qualifiers; this many go through. */
export const QUALIFY_CUT = 32;

/** Each knockout round and the players it starts with. */
export const ROUND_SIZE: Record<RoundKey, number> = { groupStage: 32, roundOf16: 16, quarterFinals: 8, semiFinals: 4, finals: 2 };
const ROUNDS = Object.keys(ROUND_SIZE) as RoundKey[];

export const isRound = (key: StageKey): key is RoundKey => key in ROUND_SIZE;

/** The bracket a field of `n` plays: the smallest round that seats everyone (2 to 32). */
export function bracketSize(n: number): number {
  return [2, 4, 8, 16, 32].find((s) => s >= n) ?? 32;
}

export function firstRound(size: number): RoundKey {
  return ROUNDS.find((r) => ROUND_SIZE[r] === size) ?? "groupStage";
}

/** Fresh stages for a new tournament: every one upcoming. */
export function newStages(): Stage[] {
  return STAGE_ORDER.map((key) => ({ key, status: "upcoming" }));
}

/** Where the tournament is: the stage in progress, and the next one it will play. */
export function stagePosition(stages: readonly Stage[]) {
  const at = stages.findIndex((s) => s.status === "inProgress");
  const current = at === -1 ? undefined : stages[at];
  const next = stages.slice(at + 1).find((s) => s.status === "upcoming");
  return { current, next };
}

/** The qualifier leaderboard: most points first; a tie goes to whoever registered earlier. */
export function qualifierRanking<T extends { points: number; registeredAt: string }>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.points - a.points || a.registeredAt.localeCompare(b.registeredAt));
}

/** Matches in a round still waiting for a result. */
export function unplayed(round: BracketRound | undefined): number {
  return round ? round.matches.filter((m) => m.winner === undefined).length : 0;
}
