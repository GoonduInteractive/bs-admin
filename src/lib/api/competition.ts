import "server-only";
import { z } from "zod";
import type {
  BracketRound,
  Champion,
  Match,
  MatchSide,
  Participant,
  Player,
  PlayerStats,
  Region,
  RegionId,
  Stage,
  StageKey,
  Tournament,
  TournamentStatus,
} from "@/types";
import { CHAMPION } from "@/lib/labels";
import { GLOBAL_REGION } from "@/lib/regions";
import { newStages, stagePosition } from "@/lib/tournaments";
import { NotFoundError, apiFetch, apiFetchAll, fromMinor } from "./client";

/** Tournaments, players and regions. */

/* ---- Tournaments: the API's ------------------------------------------- */

/**
 * The API runs a tournament's life: drawing the bracket, qualifiers, byes and
 * who goes through are the backend's (`/start`, `/advance`,
 * `/matches/{id}/result`, `/players/{entryId}/disqualify`, `/cancel`), and the
 * admin reads back what it decided.
 *
 * WHAT THE API DOESN'T TAKE (FLAGGED): a start time for the first stage
 * (`/start` has no body - the admin's date is not sent), when a qualifier
 * window closes (`/advance` takes only `starts_at`), and match scores (the
 * admin records a winner). A tournament's `format` is sent as single
 * elimination, the bracket this admin draws; every tournament is free
 * (`is_paid: false`, per legal, 2026-10-02).
 */

const API_STATUS: Record<string, TournamentStatus> = {
  draft: "draft",
  coming_soon: "comingSoon",
  registration_open: "registrationOpen",
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
};
const TO_API_STATUS: Partial<Record<TournamentStatus, string>> = {
  draft: "draft",
  comingSoon: "coming_soon",
  registrationOpen: "registration_open",
};

/** The API's stages as the admin's. Its 32-player round is the admin's Group stage, as is its group stage. */
const API_STAGE: Record<string, StageKey> = {
  registration: "registration",
  qualifiers: "qualifiers",
  group_stage: "groupStage",
  round_of_32: "groupStage",
  round_of_16: "roundOf16",
  quarter_finals: "quarterFinals",
  semi_finals: "semiFinals",
  finals: "finals",
};
const API_STAGE_STATUS: Record<string, Stage["status"]> = {
  done: "completed",
  in_progress: "inProgress",
  upcoming: "upcoming",
  skipped: "skipped",
};

const apiRegionRef = z.object({ name: z.string(), slug: z.string() });

const apiTournamentItem = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  featured: z.boolean().default(false),
  player_slots: z.number().nullish(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  prize_pool_minor: z.coerce.number().default(0),
  region: apiRegionRef.nullish(),
  entries: z.coerce.number().default(0),
});

const apiTournamentDetail = apiTournamentItem.extend({
  description: z.string().nullish(),
  region_id: z.string().nullish(),
  registration_closes_at: z.string().nullish(),
  in_game_rewards: z.boolean().default(false),
  prize_splits: z.array(z.object({ position: z.number(), share_percent: z.coerce.number() })).default([]),
  registered: z.coerce.number().nullish(),
  // A stage's dates since 2026-11-02; the spec types them loosely, so only a string is taken.
  journey: z.array(z.object({ key: z.string(), state: z.string(), started_at: z.unknown().optional(), ended_at: z.unknown().optional() })).default([]),
});
const dateOrNone = (v: unknown) => (typeof v === "string" && v ? v : undefined);
type ApiTournamentDetail = z.output<typeof apiTournamentDetail>;

const apiMatchPlayer = z.object({ id: z.string(), username: z.string().nullish(), game_player_id: z.string().nullish() }).nullish();
const apiMatch = z.object({
  id: z.string(),
  position: z.number().default(0),
  scheduled_at: z.string().nullish(),
  played_at: z.string().nullish(),
  player1: apiMatchPlayer,
  player2: apiMatchPlayer,
  player1_score: z.number().nullish(),
  player2_score: z.number().nullish(),
  winner_id: z.string().nullish(),
});
const apiBracket = z.object({
  drawn: z.boolean().default(false),
  stages: z.array(z.object({ stage: z.string(), matches: z.array(apiMatch) })).default([]),
  // Since 2026-11-02: the ranked field when it's bigger than the bracket, and the rounds to come.
  qualifier: z
    .object({
      cutoff: z.number(),
      entries: z.array(
        z.object({
          rank: z.number(),
          player_id: z.string(),
          username: z.string().nullish(),
          full_name: z.string().nullish(),
          points: z.coerce.number().default(0),
          through: z.boolean().default(false),
        }),
      ),
    })
    .nullish(),
  projected: z.array(z.object({ stage: z.string(), label: z.string(), matches: z.number() })).default([]),
});

const apiEntry = z.object({
  id: z.string(),
  seed: z.number().nullish(),
  status: z.string(),
  final_position: z.number().nullish(),
  registered_at: z.string(),
  points: z.coerce.number().default(0),
  player: z.object({
    id: z.string(),
    username: z.string().nullish(),
    game_player_id: z.string().nullish(),
    region_name: z.string().nullish(),
  }),
});

const handleOf = (p: { username?: string | null; game_player_id?: string | null }) => p.username || p.game_player_id || "-";

/** The region a tournament is for, as the form's select holds it: an id, or GLOBAL_REGION. */
function regionOf(t: { region?: { slug: string } | null; region_id?: string | null }): RegionId {
  if (!t.region || t.region.slug === GLOBAL_REGION) return GLOBAL_REGION;
  return t.region_id ?? t.region.slug;
}

/** A list row: what the table and the stat cards need. The rest is the detail's. */
function fromListItem(t: z.output<typeof apiTournamentItem>): Tournament {
  return {
    id: t.id,
    slug: t.slug,
    name: t.title,
    description: "",
    status: API_STATUS[t.status] ?? "draft",
    region: regionOf(t),
    format: "oneVone",
    ...(t.starts_at && { startsAt: t.starts_at }),
    ...(t.ends_at && { endsAt: t.ends_at }),
    prizePool: fromMinor(t.prize_pool_minor),
    prizeSplit: [],
    slots: { taken: t.entries, total: t.player_slots ?? null },
    inGameRewards: false,
    stages: [],
    bracket: [],
    participants: [],
    featured: t.featured,
  };
}

function fromDetail(
  t: ApiTournamentDetail,
  bracket: z.output<typeof apiBracket> | null,
  entries: z.output<typeof apiEntry>[],
  regionByName: Map<string, RegionId>,
): Tournament {
  const stages = [...new Map(t.journey.flatMap((s) => (API_STAGE[s.key] ? [[API_STAGE[s.key], s] as const] : []))).entries()].map(
    ([key, s]): Stage => {
      const startsAt = dateOrNone(s.started_at);
      const endsAt = dateOrNone(s.ended_at);
      return { key, status: API_STAGE_STATUS[s.state] ?? "upcoming", ...(startsAt && { startsAt }), ...(endsAt && { endsAt }) };
    },
  );
  const side = (p: z.output<typeof apiMatchPlayer>, score?: number | null): MatchSide | null =>
    p ? { handle: handleOf(p), playerId: p.id, ...(score != null && { points: score }) } : null;
  const rounds = (bracket?.drawn ? bracket.stages : []).flatMap((s): BracketRound[] => {
    const key = API_STAGE[s.stage];
    if (!key || key === "registration" || key === "qualifiers") return [];
    const matches = [...s.matches]
      .sort((a, b) => a.position - b.position)
      .map((m): Match => {
        const winner = m.winner_id && m.winner_id === m.player1?.id ? 0 : m.winner_id && m.winner_id === m.player2?.id ? 1 : undefined;
        return {
          id: m.id,
          sides: [side(m.player1, m.player1_score), side(m.player2, m.player2_score)],
          ...(m.scheduled_at && { scheduledAt: m.scheduled_at }),
          ...(m.played_at && { playedAt: m.played_at }),
          ...(winner !== undefined && { winner }),
        };
      });
    return [{ key, matches }];
  });
  const ENTRY_STATUS: Record<string, Participant["status"]> = { registered: "registered", still_in: "active", eliminated: "eliminated", disqualified: "eliminated" };
  return {
    ...fromListItem(t),
    description: t.description ?? "",
    region: regionOf(t),
    ...(t.registration_closes_at && { registrationClosesAt: t.registration_closes_at }),
    prizeSplit: [...t.prize_splits].sort((a, b) => a.position - b.position).map((s) => s.share_percent),
    slots: { taken: t.registered ?? t.entries, total: t.player_slots ?? null },
    inGameRewards: t.in_game_rewards,
    // A tournament the API sends no journey for still has the admin's seven stages to show.
    stages: stages.length ? stages : newStages(),
    bracket: rounds,
    participants: entries.map((e) => ({
      playerId: e.player.id,
      entryId: e.id,
      handle: handleOf(e.player),
      region: (e.player.region_name && regionByName.get(e.player.region_name.toLowerCase())) || GLOBAL_REGION,
      seed: e.seed ?? 0,
      points: e.points,
      status: e.final_position === 1 ? "champion" : (ENTRY_STATUS[e.status] ?? "registered"),
      registeredAt: e.registered_at,
    })),
    ...(bracket?.qualifier && {
      qualifier: {
        cutoff: bracket.qualifier.cutoff,
        entries: [...bracket.qualifier.entries]
          .sort((a, b) => a.rank - b.rank)
          .map((q) => ({ rank: q.rank, playerId: q.player_id, handle: q.username || q.full_name || "-", points: q.points, through: q.through })),
      },
    }),
    ...(bracket?.projected.length && { projected: bracket.projected.map((p) => ({ label: p.label, matches: p.matches })) }),
  };
}

/** The Global region's id: the form's GLOBAL_REGION, as the API names it. */
async function globalRegionId(): Promise<string> {
  const global = (await apiFetchAll("/v1/admin/regions", apiRegion)).find((r) => r.slug === GLOBAL_REGION);
  if (!global) throw new Error("The server has no Global region to open this tournament to");
  return global.id;
}

/** The form's tournament as the API's create and edit body. */
async function toApiBody(t: Tournament) {
  const status = TO_API_STATUS[t.status];
  return {
    title: t.name,
    description: t.description,
    region_id: t.region === GLOBAL_REGION ? await globalRegionId() : t.region,
    format: "single_elimination",
    player_slots: t.slots.total,
    // A running tournament's status is the lifecycle's to change, not the form's.
    ...(status && { status }),
    featured: t.featured,
    ...(t.registrationClosesAt && { registration_closes_at: t.registrationClosesAt }),
    ...(t.startsAt && { starts_at: t.startsAt }),
    ...(t.endsAt && { ends_at: t.endsAt }),
    is_paid: false,
    // Naira (`prize_pool`, since 2026-11-02; `prize_pool_minor` before). Replies still give kobo.
    prize_pool: t.prizePool,
    prize_splits: t.prizeSplit.map((share, i) => ({ position: i + 1, share_percent: share })),
    in_game_rewards: t.inGameRewards,
  };
}

/** The API's id for a tournament the admin's routes name by slug. */
async function tournamentId(slug: string): Promise<string> {
  const t = (await apiFetchAll("/v1/admin/tournaments", apiTournamentItem)).find((x) => x.slug === slug);
  if (!t) throw new NotFoundError("Tournament", slug);
  return t.id;
}

const tournamentPath = (id: string, rest = "") => `/v1/admin/tournaments/${encodeURIComponent(id)}${rest}`;

/** The prize figures, from the API's own sums (`/stats`); null without the API. */
export async function getTournamentStats(): Promise<{ committed: number; awarded: number }> {
  const s = await apiFetch(
    "/v1/admin/tournaments/stats",
    z.object({ prize_committed_minor: z.coerce.number().default(0), prize_awarded_minor: z.coerce.number().default(0) }),
  );
  return { committed: fromMinor(s.prize_committed_minor), awarded: fromMinor(s.prize_awarded_minor) };
}

/* ---- Tournaments ------------------------------------------------------- */

export async function getTournaments(): Promise<Tournament[]> {
  return (await apiFetchAll("/v1/admin/tournaments", apiTournamentItem)).map(fromListItem);
}

export async function getTournament(slug: string): Promise<Tournament> {
  const id = await tournamentId(slug);
  const [detail, bracket, entries, regions] = await Promise.all([
    apiFetch(tournamentPath(id), apiTournamentDetail),
    // Not drawn yet can be an error to some APIs; it's no bracket either way.
    apiFetch(tournamentPath(id, "/bracket"), apiBracket).catch(() => null),
    apiFetchAll(tournamentPath(id, "/players"), apiEntry),
    getRegions(),
  ]);
  const byName = new Map(regions.map((r) => [r.name.toLowerCase(), r.id] as const));
  return fromDetail(detail, bracket, entries, byName);
}

/** Creates (`isNew`) or updates a tournament. Returns it as saved, with the slug the API gave it. */
export async function saveTournament(tournament: Tournament, isNew: boolean): Promise<Tournament> {
  const body = await toApiBody(tournament);
  const saved = isNew
    ? await apiFetch("/v1/admin/tournaments", apiTournamentItem, { method: "POST", body })
    : await apiFetch(tournamentPath(tournament.id), apiTournamentItem, { method: "PUT", body });
  return { ...tournament, id: saved.id, slug: saved.slug };
}

export async function setTournamentStatus(slug: string, status: TournamentStatus): Promise<Tournament> {
  const t = await getTournament(slug);
  if (status === "cancelled") {
    await apiFetch(tournamentPath(t.id, "/cancel"), z.unknown(), { method: "POST" });
  } else if (TO_API_STATUS[status]) {
    // The API sets a status through the edit, which wants the whole tournament.
    await saveTournament({ ...t, status }, false);
  } else {
    throw new Error("A tournament goes live, and completes, through its stages");
  }
  return { ...t, status };
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
  // Registration closing is the API's `/start`, which draws the field and takes no date; every later step is `/advance`.
  const { current } = stagePosition(t.stages);
  const starting = t.status === "registrationOpen" || !current || current.key === "registration";
  if (starting) await apiFetch(tournamentPath(t.id, "/start"), z.unknown(), { method: "POST" });
  else await apiFetch(tournamentPath(t.id, "/advance"), z.unknown(), { method: "POST", body: schedule ? { starts_at: schedule.startsAt } : {} });
  return getTournament(slug);
}

/**
 * Record a match result: the winner's side is kept, the match is stamped as
 * played, and the winner is written into the seat they earned next round -
 * where a bye waiting for them gives an automatic win.
 */
export async function recordResult(slug: string, matchId: string, winner: 0 | 1): Promise<Tournament> {
  const t = await getTournament(slug);
  const match = t.bracket.flatMap((r) => r.matches).find((m) => m.id === matchId);
  if (!match) throw new NotFoundError("Match", matchId);
  const side = match.sides[winner];
  if (!side?.playerId || !match.sides[winner === 0 ? 1 : 0]) throw new Error("Both players must be decided before a result is recorded");
  await apiFetch(tournamentPath(t.id, `/matches/${encodeURIComponent(matchId)}/result`), z.unknown(), {
    method: "POST",
    body: { winner_id: side.playerId },
  });
  return getTournament(slug);
}

/** Out of the tournament. In the bracket, their opponent advances against a bye. */
export async function disqualify(slug: string, playerId: string): Promise<Tournament> {
  const t = await getTournament(slug);
  const p = t.participants.find((x) => x.playerId === playerId);
  if (!p?.entryId) throw new NotFoundError("Entry", playerId);
  await apiFetch(tournamentPath(t.id, `/players/${encodeURIComponent(p.entryId)}/disqualify`), z.unknown(), { method: "POST" });
  return getTournament(slug);
}

/* ---- Players ----------------------------------------------------------- */

/**
 * The API's player record. `email` isn't in the spec; it's read if the backend
 * starts sending it. The spec types `level` and `email_verified` as strings,
 * so a string or the obvious type is accepted for each.
 */
const apiPlayer = z.object({
  id: z.string(),
  // The spec says always; a player who signed up on the site has none until they set one
  // in Edit Profile (seen 2026-10-26) - sign-up takes a Gamer ID, not a username.
  username: z.string().nullish(),
  game_player_id: z.string().nullish(),
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
  // No username yet: their Gamer ID, else their email, so the row still says who it is.
  const handle = p.username || p.game_player_id || p.email || p.id;
  return {
    id: p.id,
    handle,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || handle,
    ...(p.email && { email: p.email }),
    ...(Number.isFinite(level) && { level }),
    ...(main && { main }),
    status: p.suspended ? "suspended" : isVerified(p.email_verified) ? "active" : "unverified",
    joinedAt: p.created_at,
    ...(p.last_login_at && { lastActiveAt: p.last_login_at }),
  };
}

export async function getPlayers(): Promise<Player[]> {
  return (await apiFetchAll("/v1/admin/players", apiPlayer)).map(toPlayer);
}

const apiPlayerStats = z.object({
  total_players: z.number(),
  week_active_players: z.number(),
  unverified_players: z.number(),
  suspended_players: z.number(),
});

export async function getPlayerStats(): Promise<PlayerStats> {
  const s = await apiFetch("/v1/admin/players/stats", apiPlayerStats);
  return { total: s.total_players, activeThisWeek: s.week_active_players, unverified: s.unverified_players, suspended: s.suspended_players };
}

/**
 * Suspend or reinstate. What that does to the tournaments they're in is the
 * API's to decide.
 */
export async function setPlayerStatus(id: string, status: "active" | "suspended"): Promise<void> {
  // The spec declares `id` as a query parameter on a path that also holds `{id}`; sending both satisfies either reading.
  const action = status === "suspended" ? "suspend" : "unsuspend";
  await apiFetch(`/v1/admin/players/${encodeURIComponent(id)}/${action}`, z.unknown(), { method: "PATCH", query: { id } });
}

/* ---- Regions ----------------------------------------------------------- */

const apiRegion = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  deleted: z.boolean().optional(),
  player_count: z.coerce.number().nullish(),
});

function toRegion(r: z.output<typeof apiRegion>): Region {
  return { id: r.id, slug: r.slug, name: r.name, status: r.status, createdAt: r.created_at, ...(r.player_count != null && { playerCount: r.player_count }) };
}

/**
 * Every region, active first, then by name. The API keeps Global as a region;
 * here Global is the "open to every region" choice (GLOBAL_REGION), not a
 * region to rename or archive, so it's left out.
 */
export async function getRegions(): Promise<Region[]> {
  const all = await apiFetchAll("/v1/admin/regions", apiRegion);
  const regions = all.filter((r) => !r.deleted && r.slug !== GLOBAL_REGION).map(toRegion);
  return regions.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
}

/** How many players have a region. */
export async function getPlayersPlaced(): Promise<number> {
  return (await apiFetch("/v1/admin/regions/stats", z.object({ players_in_regions: z.number() }))).players_in_regions;
}

export async function createRegion(name: string): Promise<Region> {
  return toRegion(await apiFetch("/v1/admin/regions", apiRegion, { method: "POST", query: { name } }));
}

export async function renameRegion(id: string, name: string): Promise<Region> {
  return toRegion(await apiFetch(`/v1/admin/regions/${encodeURIComponent(id)}/rename`, apiRegion, { method: "PATCH", body: { name } }));
}

/** Archive or restore. The API only toggles, so a region already in `status` is left alone. */
export async function setRegionStatus(region: Region, status: Region["status"]): Promise<void> {
  if (region.status === status) return;
  await apiFetch(`/v1/admin/regions/${encodeURIComponent(region.id)}/toggle-archive`, z.unknown(), { method: "PATCH" });
}

/** The API has no endpoint to delete a region yet: the admin is told so. */
export async function deleteRegion(): Promise<never> {
  throw new Error("The server can't delete regions yet. Archive it instead.");
}
