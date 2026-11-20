"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failureMessage } from "@/lib/api/client";
import { getPlayers, setPlayerStatus } from "@/lib/api/competition";
import { getSeedsLedger, reverseSeedsEntry } from "@/lib/api/points";
import type { SeedsLedger } from "@/types";

const input = z.object({ id: z.string().min(1), status: z.enum(["active", "suspended"]) });

/**
 * Suspend or reinstate. Suspending takes `typedHandle`, what the admin typed
 * in the confirm dialog, and checks it here too, so only a deliberate,
 * handle-typed confirmation suspends anyone. Reinstating needs none.
 */
export async function setPlayerStatusAction(id: string, status: "active" | "suspended", typedHandle?: string) {
  const parsed = input.safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid request" };

  try {
    const player = (await getPlayers()).find((p) => p.id === parsed.data.id);
    if (!player) return { error: "That player no longer exists" };
    if (parsed.data.status === "suspended") {
      if (player.status === "suspended") return { error: `@${player.handle} is already suspended` };
      if (typedHandle?.trim() !== player.handle) return { error: `Type @${player.handle}'s handle exactly to suspend them` };
    }
    await setPlayerStatus(parsed.data.id, parsed.data.status);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the player") };
  }

  revalidatePath("/players");
  // A suspension also takes them out of the brackets they were in.
  revalidatePath("/tournaments", "layout");
  return { ok: true as const };
}

/** A player's Seeds, for their profile panel: read when it opens, not with the whole list. */
export async function getSeedsAction(playerId: string): Promise<{ ledger: SeedsLedger } | { error: string }> {
  if (!z.string().min(1).safeParse(playerId).success) return { error: "Invalid request" };
  try {
    return { ledger: await getSeedsLedger(playerId) };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't load their Seeds") };
  }
}

const reversal = z.object({ playerId: z.string().min(1), entryId: z.string().min(1), reason: z.string().trim().max(500) });

/**
 * Claws an entry's Seeds back. The reason goes to the API with it, for the
 * record. Answers with the player's ledger as it now stands.
 */
export async function reverseSeedsAction(playerId: string, entryId: string, reason: string) {
  const parsed = reversal.safeParse({ playerId, entryId, reason });
  if (!parsed.success) return { error: "Keep the reason under 500 characters" };

  try {
    const reversed = await reverseSeedsEntry(parsed.data.entryId, parsed.data.reason);
    return { reversed, ledger: await getSeedsLedger(parsed.data.playerId) };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't reverse those Seeds") };
  }
}
