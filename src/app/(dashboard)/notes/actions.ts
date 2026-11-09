"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/api/auth";
import { failureMessage } from "@/lib/api/client";
import { moderateNote } from "@/lib/api/notes";

function refresh() {
  revalidatePath("/notes");
  // The sidebar's count and the bell's notice live in the layout.
  revalidatePath("/");
}

const moderation = z.object({ id: z.string().min(1), status: z.enum(["approved", "rejected"]) });

/** Approve a note onto the Community Wall, or reject it off. The signed-in admin is recorded as the moderator. */
export async function moderateNoteAction(id: string, status: "approved" | "rejected") {
  const parsed = moderation.safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid request" };
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Your session ended. Sign in again to moderate." };

  try {
    await moderateNote(parsed.data.id, parsed.data.status);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the note") };
  }
  refresh();
  return { ok: true as const };
}

