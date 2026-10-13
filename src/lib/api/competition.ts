import "server-only";
import { z } from "zod";
import type { Champion, Player, PlayerStats, Region, StageKey, Tournament, TournamentStatus } from "@/types";
import { CHAMPION, STAGE as STAGE_LABEL } from "@/lib/labels";
import { GLOBAL_REGION, isRegion } from "@/lib/regions";
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
import { DAY, MOCK_NOW } from "@/lib/mock/random";
import { REGIONS } from "@/lib/mock/regions";
import { TOURNAMENTS } from "@/lib/mock/tournaments";
import { LIVE, NotFoundError, apiFetch, apiFetchAll, mockDelay } from "./client";

/**
 * Tournaments, players and regions. Players and regions are LIVE when
 * `BS_API_URL` is set (see `client.ts`); tournaments have no endpoint yet
 * (`/v1/admin/tournaments` is a placeholder) and stay on the mock.
 */

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

/* ---- Players ----------------------------------------------------------- */

/**
 * The API's player record. `email` isn't in the spec; it's read if the backend
 * starts sending it. The spec types `level` and `email_verified` as strings,
 * so a string or the obvious type is accepted for each.
 */
const apiPlayer = z.object({
  id: z.string(),
  username: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string().nullish(),
  level: z.union([z.number(), z.string()]).nullish(),
  email_verified: z.union([z.boolean(), z.string()]).nullish(),
  suspended: z.boolean(),
  created_at: z.string(),
  last_login_at: z.string().nullish(),
  main_character: z.string().nullish(),
});

function isVerified(v: boolean | string | null | undefined): boolean {
  if (typeof v === "boolean") return v;
  return !!v && !["false", "0"].includes(v.toLowerCase());
}

/** "Ogbun'abali" or "ogbunabali" -> "ogbunabali". Anything not a known champion is left out. */
function champion(name: string | null | undefined): Champion | undefined {
  const key = name?.toLowerCase().replace(/[^a-z]/g, "");
  return (Object.keys(CHAMPION) as Champion[]).find((c) => c === key);
}

function toPlayer(p: z.output<typeof apiPlayer>): Player {
  const level = p.level == null ? NaN : Number(p.level);
  const main = champion(p.main_character);
  return {
    id: p.id,
    handle: p.username,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username,
    ...(p.email && { email: p.email }),
    ...(Number.isFinite(level) && { level }),
    ...(main && { main }),
    status: p.suspended ? "suspended" : isVerified(p.email_verified) ? "active" : "unverified",
    joinedAt: p.created_at,
    ...(p.last_login_at && { lastActiveAt: p.last_login_at }),
  };
}

export async function getPlayers(): Promise<Player[]> {
  if (LIVE) return (await apiFetchAll("/v1/admin/players", apiPlayer)).map(toPlayer);
  await mockDelay();
  return [...PLAYERS];
}

const apiPlayerStats = z.object({
  total_players: z.number(),
  week_active_players: z.number(),
  unverified_players: z.number(),
  suspended_players: z.number(),
});

export async function getPlayerStats(): Promise<PlayerStats> {
  if (LIVE) {
    const s = await apiFetch("/v1/admin/players/stats", apiPlayerStats);
    return { total: s.total_players, activeThisWeek: s.week_active_players, unverified: s.unverified_players, suspended: s.suspended_players };
  }
  await mockDelay();
  // MOCK_NOW keeps "this week" consistent with the fixtures.
  return {
    total: PLAYERS.length,
    activeThisWeek: PLAYERS.filter((p) => p.lastActiveAt && Date.parse(p.lastActiveAt) > MOCK_NOW - 7 * DAY).length,
    unverified: PLAYERS.filter((p) => p.status === "unverified").length,
    suspended: PLAYERS.filter((p) => p.status === "suspended").length,
  };
}

/**
 * Suspend or reinstate. MOCK: suspending also takes the player out of every
 * tournament they're still playing (out of the field, and in the bracket their
 * opponent advances against a bye); reinstating doesn't put them back. LIVE:
 * the API's own rules apply; tournaments aren't served yet.
 */
export async function setPlayerStatus(id: string, status: "active" | "suspended"): Promise<void> {
  if (LIVE) {
    // The spec declares `id` as a query parameter on a path that also holds `{id}`; sending both satisfies either reading.
    const action = status === "suspended" ? "suspend" : "unsuspend";
    await apiFetch(`/v1/admin/players/${encodeURIComponent(id)}/${action}`, z.unknown(), { method: "PATCH", query: { id } });
    return;
  }

  await mockDelay();
  const p = PLAYERS.find((x) => x.id === id);
  if (!p) throw new NotFoundError("Player", id);
  p.status = status;
  if (status !== "suspended") return;
  for (const t of TOURNAMENTS) {
    if (t.status !== "active" && t.status !== "registrationOpen") continue;
    const entry = t.participants.find((x) => x.playerId === id && (x.status === "active" || x.status === "registered"));
    if (!entry) continue;
    entry.status = "eliminated";
    forfeit(t.bracket, entry.handle);
  }
}

/* ---- Regions ----------------------------------------------------------- */

const apiRegion = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  deleted: z.boolean().optional(),
});

function toRegion(r: z.output<typeof apiRegion>): Region {
  return { id: r.id, slug: r.slug, name: r.name, status: r.status, createdAt: r.created_at };
}

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Every region, active first, then by name. The API keeps Global as a region;
 * here Global is the "open to every region" choice (GLOBAL_REGION), not a
 * region to rename or archive, so it's left out.
 */
export async function getRegions(): Promise<Region[]> {
  let regions: Region[];
  if (LIVE) {
    const all = await apiFetchAll("/v1/admin/regions", apiRegion);
    regions = all.filter((r) => !r.deleted && r.slug !== GLOBAL_REGION).map(toRegion);
  } else {
    await mockDelay();
    regions = [...REGIONS];
  }
  return regions.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}

/** How many players have a region. */
export async function getPlayersPlaced(): Promise<number> {
  if (LIVE) return (await apiFetch("/v1/admin/regions/stats", z.object({ players_in_regions: z.number() }))).players_in_regions;
  return PLAYERS.filter((p) => REGIONS.some((r) => isRegion(r, p.region))).length;
}

export async function createRegion(name: string): Promise<Region> {
  if (LIVE) return toRegion(await apiFetch("/v1/admin/regions", apiRegion, { method: "POST", query: { name } }));
  await mockDelay();
  const region: Region = { id: `reg_${crypto.randomUUID().slice(0, 8)}`, slug: slugify(name), name, status: "active", createdAt: new Date().toISOString() };
  REGIONS.push(region);
  return region;
}

export async function renameRegion(id: string, name: string): Promise<Region> {
  if (LIVE) {
    return toRegion(await apiFetch(`/v1/admin/regions/${encodeURIComponent(id)}/rename`, apiRegion, { method: "PATCH", body: { name } }));
  }
  await mockDelay();
  const region = REGIONS.find((r) => r.id === id);
  if (!region) throw new NotFoundError("Region", id);
  region.name = name;
  return region;
}

/** Archive or restore. The API only toggles, so a region already in `status` is left alone. */
export async function setRegionStatus(region: Region, status: Region["status"]): Promise<void> {
  if (region.status === status) return;
  if (LIVE) {
    await apiFetch(`/v1/admin/regions/${encodeURIComponent(region.id)}/toggle-archive`, z.unknown(), { method: "PATCH" });
    return;
  }
  await mockDelay();
  const r = REGIONS.find((x) => x.id === region.id);
  if (r) r.status = status;
}

export async function deleteRegion(id: string): Promise<void> {
  if (LIVE) throw new Error("The server can't delete regions yet. Archive it instead.");
  await mockDelay();
  const i = REGIONS.findIndex((r) => r.id === id);
  if (i !== -1) REGIONS.splice(i, 1);
}
