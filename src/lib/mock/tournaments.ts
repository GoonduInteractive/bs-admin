import type {
  BracketRound,
  Match,
  Participant,
  RegionId,
  Stage,
  StageKey,
  StageStatus,
  Tournament,
} from "@/types";
import { DEFAULT_PRIZE_SPLIT, STAGE_ORDER } from "@/lib/tournaments";
import { PLAYERS } from "./players";
import { createRandom, daysAgo, daysFromNow } from "./random";

/**
 * Tournaments. The first four are the public Competition page's own
 * (Wrath of Nze Ugwuoke, Lagos Ascendant League, Eastern Province Cup,
 * Rivers State Trial); the completed and draft ones exist so the admin has
 * every state to show. Tournaments roll out from October 2026.
 */

/** Stages up to `current` completed (or skipped, for the ones in `skip`), `current` in progress, the rest upcoming. */
function stagesUpTo(current: StageKey | "done" | null, skip: StageKey[] = []): Stage[] {
  const at = current === "done" ? STAGE_ORDER.length : current ? STAGE_ORDER.indexOf(current) : -1;
  return STAGE_ORDER.map((key, i) => ({
    key,
    status: (skip.includes(key) ? "skipped" : i < at ? "completed" : i === at ? "inProgress" : "upcoming") as StageStatus,
  }));
}

const rand = createRandom(99);

function participantsFor(region: RegionId | null, count: number, seedOffset: number): Participant[] {
  const pool = PLAYERS.filter((p) => p.status === "active" && (!region || region === "global" || p.region === region));
  const pickFrom = pool.length >= count ? pool : PLAYERS.filter((p) => p.status === "active");
  return pickFrom.slice(0, count).map((p, i) => ({
    playerId: p.id,
    handle: p.handle,
    region: p.region,
    seed: i + 1,
    points: Math.max(0, 2400 - i * 110 + rand.int(-60, 60) - seedOffset),
    status: "registered",
    registeredAt: daysAgo(rand.int(3, 20), rand.int(9, 22)),
  }));
}

/* ---- Lagos Ascendant League: an ongoing bracket ------------------------ */

const LAGOS_16 = [
  "somamain", "bashir_ad", "chihunter", "ngozi_ok", "kairaking", "tamunob", "spiritwolf", "kwame_m",
  "nzeforce", "amaraeze", "obi_flame", "lagoslegend", "yemi_x", "efe_storm", "dayo_dark", "fola_fury",
];

const r16: Match[] = Array.from({ length: 8 }, (_, i) => {
  const a = LAGOS_16[i * 2];
  const b = LAGOS_16[i * 2 + 1];
  return {
    id: `lagos-r16-${i + 1}`,
    sides: [
      { handle: a, points: 2000 - rand.int(0, 2) * 100 },
      { handle: b, points: 900 + rand.int(0, 6) * 100 },
    ],
    playedAt: daysAgo(19 - Math.floor(i / 3), 16 + (i % 3) * 2),
    winner: 0,
  };
});

const qfWinners = r16.map((m) => m.sides[0]!.handle);

const LAGOS_BRACKET: BracketRound[] = [
  { key: "roundOf16", matches: r16 },
  {
    key: "quarterFinals",
    matches: Array.from({ length: 4 }, (_, i) => ({
      id: `lagos-qf-${i + 1}`,
      sides: [
        { handle: qfWinners[i * 2], points: 1200 + rand.int(0, 8) * 100 },
        { handle: qfWinners[i * 2 + 1], points: 900 + rand.int(0, 8) * 100 },
      ] as Match["sides"],
      endsAt: daysFromNow(1, 20),
    })),
  },
  {
    key: "semiFinals",
    matches: [
      { id: "lagos-sf-1", sides: [null, null], scheduledAt: daysFromNow(5, 19) },
      { id: "lagos-sf-2", sides: [null, null], scheduledAt: daysFromNow(5, 21) },
    ],
  },
  { key: "finals", matches: [{ id: "lagos-f", sides: [null, null], scheduledAt: daysFromNow(12, 20) }] },
];

const lagosParticipants: Participant[] = LAGOS_16.map((handle, i) => {
  const player = PLAYERS.find((p) => p.handle === handle)!;
  return {
    playerId: player.id,
    handle,
    region: player.region,
    seed: i + 1,
    points: 2400 - i * 90,
    status: i % 2 === 0 ? "active" : "eliminated",
    registeredAt: daysAgo(34 - i, 12),
  };
});

/* ---- Harmattan Clash: finished ----------------------------------------- */

const harmattanParticipants = participantsFor("abuja", 8, 200).map((p, i) => ({
  ...p,
  status: (i === 0 ? "champion" : "eliminated") as Participant["status"],
}));

/* ---- Ascension Open: a big field in Qualifiers ------------------------- */

/**
 * A SAMPLE, not one of the public site's tournaments: 318 players, unlimited
 * slots, so it opened with Qualifiers. Their points are the qualifier
 * leaderboard; the top 32 go into the Group stage when an admin moves on.
 * Its own random stream, so the fixtures above don't shift.
 */
const openRand = createRandom(314);
const HANDLE_A = ["soma", "kaira", "nze", "obi", "ada", "chi", "ike", "ngozi", "tobi", "ama", "kwame", "efe", "dayo", "yemi", "fola", "uche", "zara", "bayo", "eze", "nneka"];
const HANDLE_B = ["main", "blade", "storm", "fury", "wolf", "flame", "king", "queen", "hunter", "ghost", "spirit", "rise", "x", "dark", "force", "legend"];
const REGION_MIX: readonly (readonly [RegionId, number])[] = [["lagos", 9], ["southEast", 7], ["abuja", 4], ["rivers", 3], ["ghana", 2]];
const OPEN_FIELD = 318;

const openParticipants: Participant[] = (() => {
  const taken = new Set<string>();
  return Array.from({ length: OPEN_FIELD }, (_, i) => {
    let handle = "";
    do handle = `${openRand.pick(HANDLE_A)}_${openRand.pick(HANDLE_B)}${openRand.int(1, 99)}`;
    while (taken.has(handle));
    taken.add(handle);
    // A strong top and a long tail: most of the field is well below the cut.
    const points = Math.round(4200 * Math.pow(1 - i / OPEN_FIELD, 1.6)) + openRand.int(0, 180);
    return {
      playerId: `plr_open_${i + 1}`,
      handle,
      region: openRand.weighted(REGION_MIX),
      seed: i + 1,
      points,
      status: "active" as const,
      registeredAt: daysAgo(openRand.int(4, 30), openRand.int(8, 23)),
    };
  });
})();

const openStages: Stage[] = stagesUpTo("qualifiers").map((s) =>
  s.key === "qualifiers" ? { ...s, startsAt: daysAgo(2, 18), endsAt: daysFromNow(3, 22) } : s,
);

export const TOURNAMENTS: Tournament[] = [
  {
    id: "trn_wrath",
    slug: "wrath-of-nze-ugwuoke",
    name: "Wrath of Nze Ugwuoke",
    description:
      "The fallen chief priest has returned, corrupting the realm and challenging ascendants to prove their worth. Battle through seasonal competitions, complete event challenges, and rise through the standings before the season comes to an end.",
    status: "registrationOpen",
    region: "global",
    format: "oneVone",
    startsAt: daysFromNow(11, 18),
    endsAt: daysFromNow(39, 20),
    registrationClosesAt: daysFromNow(9, 23),
    prizePool: 1_500_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 214, total: 256 },
    inGameRewards: true,
    stages: stagesUpTo("registration"),
    bracket: [],
    participants: participantsFor("global", 24, 0),
    featured: true,
  },
  {
    id: "trn_lagos",
    slug: "lagos-ascendant-league",
    name: "Lagos Ascendant League",
    description: "Lagos State's first regional league. Sixteen ascendants, single elimination, one champion.",
    status: "active",
    region: "lagos",
    format: "oneVone",
    startsAt: daysAgo(21, 18),
    endsAt: daysFromNow(12, 22),
    prizePool: 500_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 16, total: 16 },
    inGameRewards: true,
    stages: stagesUpTo("quarterFinals", ["qualifiers", "groupStage"]),
    bracket: LAGOS_BRACKET,
    participants: lagosParticipants,
    featured: false,
  },
  {
    id: "trn_eastern",
    slug: "eastern-province-cup",
    name: "Eastern Province Cup",
    description: "South East regional cup. Qualifiers run through October; the top eight go to Enugu for finals.",
    status: "registrationOpen",
    region: "southEast",
    format: "oneVone",
    startsAt: daysFromNow(16, 18),
    endsAt: daysFromNow(30, 20),
    registrationClosesAt: daysFromNow(12, 23),
    prizePool: 400_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 41, total: 64 },
    inGameRewards: true,
    stages: stagesUpTo("registration"),
    bracket: [],
    participants: participantsFor("southEast", 12, 100),
    featured: false,
  },
  {
    id: "trn_rivers",
    slug: "rivers-state-trial",
    name: "Rivers State Trial",
    description: "Port Harcourt's first trial. Dates to be confirmed with the venue partner.",
    status: "comingSoon",
    region: "rivers",
    format: "oneVone",
    prizePool: 300_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 0, total: 32 },
    inGameRewards: true,
    stages: stagesUpTo(null),
    bracket: [],
    participants: [],
    featured: false,
  },
  {
    id: "trn_harmattan",
    slug: "harmattan-clash",
    name: "Harmattan Clash",
    description: "The closed beta's invitational in Abuja. Eight invited ascendants.",
    status: "completed",
    region: "abuja",
    format: "oneVone",
    startsAt: daysAgo(62, 18),
    endsAt: daysAgo(55, 21),
    prizePool: 200_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 8, total: 8 },
    inGameRewards: true,
    stages: stagesUpTo("done", ["qualifiers", "groupStage", "roundOf16"]),
    bracket: [],
    participants: harmattanParticipants,
    featured: false,
  },
  {
    id: "trn_accra",
    slug: "accra-gate-invitational",
    name: "Accra Gate Invitational",
    description: "Draft. The first league outside Nigeria, pending the Ghana partner agreement.",
    status: "draft",
    region: "ghana",
    format: "oneVone",
    prizePool: 250_000,
    prizeSplit: [...DEFAULT_PRIZE_SPLIT],
    slots: { taken: 0, total: 32 },
    inGameRewards: true,
    stages: stagesUpTo(null),
    bracket: [],
    participants: [],
    featured: false,
  },
  {
    id: "trn_open",
    slug: "ascension-open",
    name: "Ascension Open",
    description:
      "Open to every region, no cap on entries. With over 32 players it opens with Qualifiers: a points leaderboard, and the top 32 go into the Group stage.",
    status: "active",
    region: "global",
    format: "oneVone",
    startsAt: daysAgo(2, 18),
    endsAt: daysFromNow(30, 20),
    registrationClosesAt: daysAgo(3, 23),
    prizePool: 2_000_000,
    prizeSplit: [40, 20, 12, 8, 5, 5, 5, 5],
    slots: { taken: 0, total: null },
    inGameRewards: true,
    stages: openStages,
    bracket: [],
    participants: openParticipants,
    featured: false,
  },
];

// Registered counts are the participant lists, so the two never disagree.
for (const t of TOURNAMENTS) t.slots.taken = t.participants.length;
