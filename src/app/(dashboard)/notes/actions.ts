"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/api/auth";
import { failureMessage } from "@/lib/api/client";
import { moderateNote, reviewModerationReport } from "@/lib/api/notes";
import { NOTE_RULES } from "@/lib/labels";

function refresh() {
  revalidatePath("/notes");
  // The sidebar's count and the bell's notice live in the layout.
  revalidatePath("/");
}

const RULE_LABELS = NOTE_RULES.filter((r) => r.key !== "self_harm").map((r) => r.label) as [string, ...string[]];

const moderation = z.discriminatedUnion("status", [
  z.object({ id: z.string().min(1), status: z.literal("approved") }),
  // A take-down names the rule the player is told they broke; none for a self-harm note.
  z.object({ id: z.string().min(1), status: z.literal("rejected"), rule: z.enum(RULE_LABELS).optional() }),
]);

/**
 * Restore a note to the Community Wall, or take it down naming the rule it
 * broke. The signed-in admin is recorded as the moderator.
 */
export async function moderateNoteAction(id: string, status: "approved" | "rejected", rule?: string) {
  const parsed = moderation.safeParse(status === "approved" ? { id, status } : { id, status, rule });
  if (!parsed.success) return { error: "Choose the rule the note broke" };
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Your session ended. Sign in again to moderate." };

  try {
    const d = parsed.data;
    await moderateNote(d.id, d.status, d.status === "rejected" ? d.rule : undefined);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the note") };
  }
  refresh();
  return { ok: true as const };
}

const review = z.object({ id: z.string().min(1), action: z.enum(["reviewed", "dismissed"]) });

/** Marks a report from the website as followed up, or dismisses it. */
export async function reviewReportAction(id: string, action: "reviewed" | "dismissed") {
  const parsed = review.safeParse({ id, action });
  if (!parsed.success) return { error: "Invalid request" };
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Your session ended. Sign in again to review reports." };

  try {
    await reviewModerationReport(parsed.data.id, parsed.data.action);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the report") };
  }
  refresh();
  return { ok: true as const };
}
