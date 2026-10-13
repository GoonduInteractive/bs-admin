import "server-only";
import type { Player, PlayerStatus, Region, StageKey, Tournament, TournamentStatus } from "@/types";
import { STAGE as STAGE_LABEL } from "@/lib/labels";
import {
  QUALIFY_CUT,
  STAGE_ORDER,
  bracketSize,
  drawBracket,
  firstRound,
  forfeit,
  qualifierRanking,
  resolveByes,
  sendForward,
  stagePosition,
  unplayed,
} from "@/lib/tournaments";
import { PLAYERS } from "@/lib/mock/players";
import { REGIONS } from "@/lib/mock/regions";
import { TOURNAMENTS } from "@/lib/mock/tournaments";
import { NotFoundError, mockDelay } from "./client";

/** Tournaments, players and regions. MOCK - see `merch.ts` for the swap rule. */

export async function getTournaments(): Promise<Tournament[]> {
  await mockDelay();
  return [...TOURNAMENTS];
}

export async function getTournament(slug: string): Promise<Tournament> {
  await mockDelay();
  const t = TOURNAMENTS.find((x) => x.slug === slug);
  if (!t) throw new NotFoundError("Tournament", slug);
  return t;
}

export async function saveTournament(tournament: Tournament): Promise<Tournament> {
  await mockDelay();
  const i = TOURNAMENTS.findIndex((t) => t.id === tournament.id);
  if (i === -1) TOURNAMENTS.unshift(tournament);
  else TOURNAMENTS[i] = tournament;
  return tournament;
}

export async function setTournamentStatus(slug: string, status: TournamentStatus): Promise<Tournament> {
  const t = await getTournament(slug);
  t.status = status;
  return t;
}

/** When the stage being opened starts, and for Qualifiers when its leaderboard window closes. */
export type StageSchedule = { startsAt: string; endsAt?: string };

/**
 * Move a running tournament on one step - the admin decides when; nothing
 * advances on its own. Each step opens the next stage at `schedule.startsAt`:
 *
 * - Registration closes. Over QUALIFY_CUT players: Qualifiers open (a
 *   leaderboard, `schedule.endsAt` its close). Otherwise the bracket is drawn
 *   at the smallest round that seats everyone, empty seats as byes.
 * - Qualifiers close: the top 32 on the leaderboard go into the Group stage;
 *   the rest are out.
 * - A round closes once every match has a result; the next round opens.
 *   Closing the Final completes the tournament (no schedule needed).
 */
export async function advanceStage(slug: string, schedule?: StageSchedule): Promise<Tournament> {
  const t = await getTournament(slug);
  const { current } = stagePosition(t.stages);
  const stage = (key: StageKey) => t.stages.find((s) => s.key === key)!;
  const open = (key: StageKey) => Object.assign(stage(key), { status: "inProgress", startsAt: schedule!.startsAt, endsAt: schedule!.endsAt });
  const needSchedule = () => {
    if (!schedule?.startsAt) throw new Error("Set when the next stage starts");
  };

  if (!current || current.key === "registration") {
    const field = t.participants.filter((p) => p.status === "registered" || p.status === "active");
    if (field.length < 2) throw new Error("At least 2 players are needed to start");
    needSchedule();
    stage("registration").status = "completed";
    t.status = "active";
    t.participants = t.participants.map((p) => (p.status === "registered" ? { ...p, status: "active" } : p));
    if (field.length > QUALIFY_CUT) {
      if (!schedule!.endsAt) throw new Error("Set when the qualifier window closes");
      open("qualifiers");
      return t;
    }
    // Small enough for the bracket: Qualifiers and any round bigger than the field are skipped.
    const size = bracketSize(field.length);
    const first = firstRound(size);
    for (const s of t.stages) if (s.key !== "registration" && STAGE_ORDER.indexOf(s.key) < STAGE_ORDER.indexOf(first)) s.status = "skipped";
    open(first);
    t.bracket = drawBracket([...field].sort((a, b) => a.seed - b.seed), size, schedule!.startsAt, t.slug);
    resolveByes(t.bracket);
    return t;
  }

  if (current.key === "qualifiers") {
    needSchedule();
    const ranked = qualifierRanking(t.participants.filter((p) => p.status === "active"));
    const through = new Set(ranked.slice(0, QUALIFY_CUT).map((p) => p.playerId));
    t.participants = t.participants.map((p) => (p.status === "active" && !through.has(p.playerId) ? { ...p, status: "eliminated" } : p));
    current.status = "completed";
    open("groupStage");
    t.bracket = drawBracket(ranked.slice(0, QUALIFY_CUT), 32, schedule!.startsAt, t.slug);
    resolveByes(t.bracket);
    return t;
  }

  // A knockout round.
  const round = t.bracket.find((r) => r.key === current.key);
  const left = unplayed(round);
  if (left) throw new Error(`${left} ${left === 1 ? "match" : "matches"} in the ${STAGE_LABEL[current.key].toLowerCase()} still need a result`);
  current.status = "completed";
  const { next } = stagePosition(t.stages);
  if (!next) {
    t.status = "completed";
    return t;
  }
  needSchedule();
  open(next.key);
  t.bracket.find((r) => r.key === next.key)?.matches.forEach((m) => {
    if (m.winner === undefined) m.scheduledAt = schedule!.startsAt;
  });
  return t;
}

/**
 * Record a match result: the winner's side is kept, the match is stamped as
 * played, and the winner is written into the seat they earned next round -
 * where a bye waiting for them gives an automatic win.
 */
export async function recordResult(slug: string, matchId: string, winner: 0 | 1): Promise<Tournament> {
  const t = await getTournament(slug);
  const r = t.bracket.findIndex((round) => round.matches.some((m) => m.id === matchId));
  if (r === -1) throw new NotFoundError("Match", matchId);
  const m = t.bracket[r].matches.findIndex((x) => x.id === matchId);
  const match = t.bracket[r].matches[m];
  const side = match.sides[winner];
  const loser = match.sides[winner === 0 ? 1 : 0];
  if (!side || !loser) throw new Error("Both players must be decided before a result is recorded");
  if (side.bye || loser.bye) throw new Error("A match against a bye is decided automatically");

  match.playedAt = new Date().toISOString();
  match.winner = winner;
  match.endsAt = undefined;
  sendForward(t.bracket, r, m, side);
  resolveByes(t.bracket);

  const isFinal = r === t.bracket.length - 1;
  t.participants = t.participants.map((p) => {
    if (p.handle === loser.handle) return { ...p, status: "eliminated" };
    if (p.handle === side.handle && isFinal) return { ...p, status: "champion" };
    return p;
  });
  return t;
}

/** Out of the tournament. In the bracket, their opponent advances against a bye. */
export async function disqualify(slug: string, playerId: string): Promise<Tournament> {
  const t = await getTournament(slug);
  const p = t.participants.find((x) => x.playerId === playerId);
  t.participants = t.participants.map((x) => (x.playerId === playerId ? { ...x, status: "eliminated" } : x));
  if (p) forfeit(t.bracket, p.handle);
  return t;
}

export async function getPlayers(): Promise<Player[]> {
  await mockDelay();
  return [...PLAYERS];
}

/**
 * Suspending a player also takes them out of every tournament they're still
 * playing: out of the field, and in the bracket their opponent advances
 * against a bye. Reinstating doesn't put them back.
 */
export async function setPlayerStatus(id: string, status: PlayerStatus): Promise<Player> {
  await mockDelay();
  const p = PLAYERS.find((x) => x.id === id);
  if (!p) throw new NotFoundError("Player", id);
  p.status = status;
  if (status === "suspended") {
    for (const t of TOURNAMENTS) {
      if (t.status !== "active" && t.status !== "registrationOpen") continue;
      const entry = t.participants.find((x) => x.playerId === id && (x.status === "active" || x.status === "registered"));
      if (!entry) continue;
      entry.status = "eliminated";
      forfeit(t.bracket, entry.handle);
    }
  }
  return p;
}

/* ---- Regions ----------------------------------------------------------- */

/** Every region, active first, then by name. */
export async function getRegions(): Promise<Region[]> {
  await mockDelay();
  return [...REGIONS].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}

export async function saveRegion(region: Region): Promise<Region> {
  await mockDelay();
  const i = REGIONS.findIndex((r) => r.id === region.id);
  if (i === -1) REGIONS.push(region);
  else REGIONS[i] = region;
  return region;
}

export async function deleteRegion(id: string): Promise<void> {
  await mockDelay();
  const i = REGIONS.findIndex((r) => r.id === id);
  if (i !== -1) REGIONS.splice(i, 1);
}
