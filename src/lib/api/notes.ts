import "server-only";
import { z } from "zod";
import { noteRuleKey } from "@/lib/labels";
import type { ModerationReport, Note, NoteMatch, NoteStats, NoteStatus } from "@/types";
import { apiFetch, apiFetchAll } from "./client";

/**
 * Community Wall moderation. Since the filter update (spec of 2026-11-19) a
 * note goes up at once and the API's automatic check flags the ones that
 * break a rule; this is the review of what it flagged.
 *
 *   GET   /v1/admin/notes              getNotes()      every note, paged through
 *   GET   /v1/admin/notes/stats        getNoteStats()
 *   PATCH /v1/admin/notes/{id}/approve moderateNote(id, "approved")              restore
 *   PATCH /v1/admin/notes/{id}/reject  moderateNote(id, "rejected", ruleLabel)   take down
 *
 * The API records the moderator itself (the signed-in admin's token). A
 * restored note is exempt from the automatic check after. There is no delete
 * endpoint: taking a note down keeps it off the wall.
 *
 * A note's author comes without an id, and with no username for a player who
 * hasn't set one: the page shows their name instead.
 */

const apiNote = z.object({
  id: z.string(),
  content: z.string(),
  author: z
    .object({ username: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish() })
    .nullish(),
  moderation_status: z.enum(["pending", "flagged", "approved", "rejected"]),
  like_count: z.coerce.number().default(0),
  moderated_by: z.object({ id: z.string(), name: z.string().nullish() }).nullish(),
  moderated_at: z.string().nullish(),
  flag_reason: z.unknown().optional(),
  flag_source: z.enum(["auto_check", "client_report", "manual"]).nullish(),
  flag_primary: z.string().nullish(),
  flag_matches: z.array(z.object({ category: z.string(), term: z.string().nullish() })).nullish(),
  moderation_urgent: z.boolean().default(false),
  past_flags: z.coerce.number().nullish(),
  flagged_at: z.string().nullish(),
  // When the automatic check ran (in the note's reply since 2026-11-20; not yet in the admin spec).
  moderation_checked_at: z.string().nullish(),
  moderation_rules_version: z.string().nullish(),
  auto_moderation_exempt: z.boolean().default(false),
  created_at: z.string(),
});

/**
 * The matches, as the API now sends them parsed (`flag_matches`, spec of
 * 2026-11-20: `{ category, term }`). A reply without them falls back to
 * `flag_reason`, the raw JSON (`{ primary, source, matches }`, or the older
 * bare list), read loosely: each match an object naming its rule (`category`,
 * `rule` or `key`) and what it matched (`term`, `entry`, `match` or `word`),
 * or a bare string taken as the rule.
 */
const firstString = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return "";
};

function readMatches(raw: unknown): NoteMatch[] {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return list ? [{ rule: list as string, entry: "" }] : [];
    }
  }
  if (list && typeof list === "object" && !Array.isArray(list)) list = (list as { matches?: unknown }).matches;
  if (!Array.isArray(list)) return [];
  return list.flatMap((m): NoteMatch[] => {
    if (typeof m === "string") return m ? [{ rule: m, entry: "" }] : [];
    if (!m || typeof m !== "object") return [];
    const o = m as Record<string, unknown>;
    const rule = firstString(o, ["category", "rule", "key", "list"]);
    return rule ? [{ rule, entry: firstString(o, ["entry", "term", "match", "word", "pattern"]) }] : [];
  });
}

function toNote(n: z.output<typeof apiNote>): Note {
  const username = n.author?.username || null;
  const name = [n.author?.first_name, n.author?.last_name].filter(Boolean).join(" ");
  const found = n.flag_matches?.length
    ? n.flag_matches.map((m) => ({ rule: m.category, entry: m.term ?? "" }))
    : readMatches(n.flag_reason);
  // The highest-priority rule first: what the "Flagged for" column leads with and the take-down suggests.
  const primary = n.flag_primary ? noteRuleKey(n.flag_primary) : null;
  const matches = primary ? [...found].sort((a, b) => Number(noteRuleKey(b.rule) === primary) - Number(noteRuleKey(a.rule) === primary)) : found;
  return {
    id: n.id,
    body: n.content,
    author: { handle: username, name: name || username || "Unknown player" },
    status: n.moderation_status,
    likes: n.like_count,
    postedAt: n.created_at,
    matches,
    exempt: n.auto_moderation_exempt,
    urgent: n.moderation_urgent || matches.some((m) => noteRuleKey(m.rule) === "self_harm"),
    ...(n.flag_source && { source: n.flag_source }),
    ...(n.past_flags != null && { pastFlags: n.past_flags }),
    ...(n.moderated_by && { moderatedBy: n.moderated_by.name || "An admin" }),
    ...(n.moderated_at && { moderatedAt: n.moderated_at }),
    ...(n.flagged_at && { flaggedAt: n.flagged_at }),
    ...(n.moderation_checked_at && { checkedAt: n.moderation_checked_at }),
    ...(n.moderation_rules_version && { rulesVersion: n.moderation_rules_version }),
  };
}

/** The queue first: urgent flags, other flags, notes still being checked; then the rest. Newest first in each. */
const rank = (n: Note) => (n.status === "flagged" ? (n.urgent ? 0 : 1) : n.status === "pending" ? 2 : 3);
const queueFirst = (notes: Note[]) => notes.sort((a, b) => rank(a) - rank(b) || b.postedAt.localeCompare(a.postedAt));

export async function getNotes(): Promise<Note[]> {
  return queueFirst((await apiFetchAll("/v1/admin/notes", apiNote)).map(toNote));
}

export async function getNoteStats(): Promise<NoteStats> {
  const s = await apiFetch(
    "/v1/admin/notes/stats",
    z.object({
      awaiting_review: z.coerce.number().default(0),
      urgent: z.coerce.number().default(0),
      pending_check: z.coerce.number().default(0),
      on_the_wall: z.coerce.number().default(0),
      rejected: z.coerce.number().default(0),
      posted_this_week: z.coerce.number().default(0),
    }),
  );
  return {
    flagged: s.awaiting_review,
    urgent: s.urgent,
    pendingCheck: s.pending_check,
    onWall: s.on_the_wall,
    rejected: s.rejected,
    postedThisWeek: s.posted_this_week,
  };
}

/* ---- Reports: notes the website refused and reported --------------------- */

/**
 * `GET /v1/admin/moderation-reports` and `PATCH …/{id}/review` (spec of
 * 2026-11-20). The website sends one when it refuses a note for self-harm or
 * underage (`POST /v1/notes/moderation-reports`); the note was never posted.
 * THE REPLY ISN'T DOCUMENTED (an empty schema), so each report is read
 * loosely: its text, the rule keys, who (`author`, `player` or `reporter`),
 * when, and a status. FLAGGED: confirm the shape with the backend.
 */
const apiPerson = z
  .object({
    username: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    game_player_id: z.string().nullish(),
    name: z.string().nullish(),
  })
  .nullish();

const apiReport = z.object({
  id: z.string(),
  content: z.string(),
  categories: z.array(z.string()).nullish(),
  status: z.string().nullish(),
  urgent: z.boolean().nullish(),
  author: apiPerson,
  player: apiPerson,
  reporter: apiPerson,
  created_at: z.string(),
});

function toReport(r: z.output<typeof apiReport>): ModerationReport {
  const who = r.author ?? r.player ?? r.reporter;
  const handle = who?.username || who?.game_player_id || null;
  const name = who?.name || [who?.first_name, who?.last_name].filter(Boolean).join(" ");
  const rules = r.categories ?? [];
  const status = /dismiss/i.test(r.status ?? "") ? "dismissed" : /review|resolv|closed/i.test(r.status ?? "") ? "reviewed" : "open";
  return {
    id: r.id,
    body: r.content,
    rules,
    author: { handle, name: name || handle || "Unknown player" },
    status,
    reportedAt: r.created_at,
    urgent: r.urgent ?? rules.some((k) => noteRuleKey(k) === "self_harm"),
  };
}

/** Open ones first, urgent at the top; newest first in each. */
export async function getModerationReports(): Promise<ModerationReport[]> {
  const rank = (r: ModerationReport) => (r.status === "open" ? (r.urgent ? 0 : 1) : 2);
  return (await apiFetchAll("/v1/admin/moderation-reports", apiReport))
    .map(toReport)
    .sort((a, b) => rank(a) - rank(b) || b.reportedAt.localeCompare(a.reportedAt));
}

/** Marks a report as followed up (`reviewed`) or not needing it (`dismissed`). */
export async function reviewModerationReport(id: string, action: "reviewed" | "dismissed"): Promise<void> {
  await apiFetch(`/v1/admin/moderation-reports/${encodeURIComponent(id)}/review`, z.unknown(), { method: "PATCH", body: { action } });
}

/**
 * Restore (back on the wall, and exempt from the automatic check) or take
 * down. A take-down names the rule broken, which the API emails to the player;
 * none for a self-harm note (see `NOTE_RULES`). Either can be undone by the
 * other. The API takes who did it from the token.
 */
export async function moderateNote(id: string, status: Extract<NoteStatus, "approved" | "rejected">, ruleCategory?: string): Promise<void> {
  const action = status === "approved" ? "approve" : "reject";
  await apiFetch(`/v1/admin/notes/${encodeURIComponent(id)}/${action}`, z.unknown(), {
    method: "PATCH",
    ...(status === "rejected" && { body: ruleCategory ? { rule_category: ruleCategory } : {} }),
  });
}
