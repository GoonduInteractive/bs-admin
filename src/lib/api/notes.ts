import "server-only";
import { z } from "zod";
import type { Note, NoteStats, NoteStatus } from "@/types";
import { apiFetch, apiFetchAll } from "./client";

/**
 * Community Wall moderation (since the spec of 2026-10-27):
 *
 *   GET   /v1/admin/notes              getNotes()      every note, paged through
 *   GET   /v1/admin/notes/stats        getNoteStats()
 *   PATCH /v1/admin/notes/{id}/approve moderateNote(id, "approved")
 *   PATCH /v1/admin/notes/{id}/reject  moderateNote(id, "rejected")
 *
 * The API records the moderator itself (the signed-in admin's token). There is
 * no delete endpoint: rejecting keeps a note off the wall.
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
  moderation_status: z.enum(["pending", "approved", "rejected"]),
  like_count: z.coerce.number().default(0),
  moderated_by: z.object({ id: z.string(), name: z.string().nullish() }).nullish(),
  moderated_at: z.string().nullish(),
  created_at: z.string(),
});

function toNote(n: z.output<typeof apiNote>): Note {
  const username = n.author?.username || null;
  const name = [n.author?.first_name, n.author?.last_name].filter(Boolean).join(" ");
  return {
    id: n.id,
    body: n.content,
    author: { handle: username, name: name || username || "Unknown player" },
    status: n.moderation_status,
    likes: n.like_count,
    postedAt: n.created_at,
    ...(n.moderated_by && { moderatedBy: n.moderated_by.name || "An admin" }),
    ...(n.moderated_at && { moderatedAt: n.moderated_at }),
  };
}

/** The queue first, then newest first within each group. */
const queueFirst = (notes: Note[]) => {
  const rank = (n: Note) => (n.status === "pending" ? 0 : 1);
  return notes.sort((a, b) => rank(a) - rank(b) || b.postedAt.localeCompare(a.postedAt));
};

export async function getNotes(): Promise<Note[]> {
  return queueFirst((await apiFetchAll("/v1/admin/notes", apiNote)).map(toNote));
}

export async function getNoteStats(): Promise<NoteStats> {
  const s = await apiFetch(
    "/v1/admin/notes/stats",
    z.object({
      awaiting_review: z.coerce.number(),
      on_the_wall: z.coerce.number(),
      rejected: z.coerce.number(),
      posted_this_week: z.coerce.number(),
    }),
  );
  return { pending: s.awaiting_review, approved: s.on_the_wall, rejected: s.rejected, postedThisWeek: s.posted_this_week };
}

/**
 * Approve (on the wall) or reject (off it). Either can be undone by the other.
 * The API takes who did it from the token.
 */
export async function moderateNote(id: string, status: Exclude<NoteStatus, "pending">): Promise<void> {
  const action = status === "approved" ? "approve" : "reject";
  await apiFetch(`/v1/admin/notes/${encodeURIComponent(id)}/${action}`, z.unknown(), { method: "PATCH" });
}
