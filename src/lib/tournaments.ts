import type { BracketRound, Match, MatchSide, RoundKey, Stage, StageKey, Tournament } from "@/types";

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

const BYE: MatchSide = { handle: "Bye", bye: true };

/**
 * Standard bracket order: seed 1 meets the lowest seed, and 1 and 2 can only
 * meet in the final. For 8: 1, 8, 4, 5, 2, 7, 3, 6 - read in pairs.
 */
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s]);
  return order;
}

/**
 * Draw the bracket: `seeded` in seed order (best first) into a bracket of
 * `size`. Empty seats are byes, so the top seeds are the ones who get them.
 * Later rounds are drawn empty and fill as results come in.
 */
export function drawBracket(seeded: readonly { handle: string }[], size: number, startsAt: string, idPrefix: string): BracketRound[] {
  const order = seedOrder(size);
  const seat = (seed: number): MatchSide => (seeded[seed - 1] ? { handle: seeded[seed - 1].handle } : BYE);
  const first = firstRound(size);
  return ROUNDS.slice(ROUNDS.indexOf(first)).map((key, r) => ({
    key,
    matches: Array.from({ length: ROUND_SIZE[key] / 2 }, (_, m) => ({
      id: `${idPrefix}-${key}-${m + 1}`,
      sides: (r === 0 ? [seat(order[m * 2]), seat(order[m * 2 + 1])] : [null, null]) as Match["sides"],
      scheduledAt: r === 0 ? startsAt : undefined,
    })),
  }));
}

/** Put a winner into the seat they earned next round: match m feeds match floor(m/2), side m % 2. */
export function sendForward(bracket: BracketRound[], r: number, m: number, side: MatchSide) {
  const next = bracket[r + 1];
  if (next) next.matches[Math.floor(m / 2)].sides[m % 2] = side.bye ? BYE : { handle: side.handle };
}

/**
 * Settle every match with a bye in it: the real player wins automatically and
 * moves on. Two byes send a bye forward. Runs until nothing changes, so a bye
 * that reaches a later round is settled too.
 */
export function resolveByes(bracket: BracketRound[], now = new Date().toISOString()) {
  for (let changed = true; changed; ) {
    changed = false;
    bracket.forEach((round, r) =>
      round.matches.forEach((match, m) => {
        const [a, b] = match.sides;
        if (match.winner !== undefined || !a || !b || !(a.bye || b.bye)) return;
        match.winner = a.bye && !b.bye ? 1 : 0;
        match.walkover = true;
        match.playedAt = now;
        match.endsAt = undefined;
        sendForward(bracket, r, m, match.sides[match.winner]!);
        changed = true;
      }),
    );
  }
}

/**
 * A player leaves the bracket - disqualified or suspended. Their seat in the
 * match they haven't played becomes a bye, so their opponent (now, or when one
 * arrives) advances automatically.
 */
export function forfeit(bracket: BracketRound[], handle: string) {
  for (const round of bracket) {
    for (const match of round.matches) {
      if (match.winner !== undefined) continue;
      const i = match.sides.findIndex((s) => s?.handle === handle && !s.bye);
      if (i !== -1) match.sides[i] = BYE;
    }
  }
  resolveByes(bracket);
}

/** The qualifier leaderboard: most points first; a tie goes to whoever registered earlier. */
export function qualifierRanking<T extends { points: number; registeredAt: string }>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.points - a.points || a.registeredAt.localeCompare(b.registeredAt));
}

/** Matches in a round still waiting for a result. */
export function unplayed(round: BracketRound | undefined): number {
  return round ? round.matches.filter((m) => m.winner === undefined).length : 0;
}
