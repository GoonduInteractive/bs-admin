"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPlayers, setPlayerStatus } from "@/lib/api/competition";

const input = z.object({ id: z.string().min(1), status: z.enum(["active", "suspended"]) });

/**
 * Suspend or reinstate. Suspending takes `typedHandle`, what the admin typed
 * in the confirm dialog, and checks it here too, so only a deliberate,
 * handle-typed confirmation suspends anyone. Reinstating needs none.
 */
export async function setPlayerStatusAction(id: string, status: "active" | "suspended", typedHandle?: string) {
  const parsed = input.safeParse({ id, status });
  if (!parsed.success) return { error: "Invalid request" };

  const player = (await getPlayers()).find((p) => p.id === parsed.data.id);
  if (!player) return { error: "That player no longer exists" };
  if (parsed.data.status === "suspended") {
    if (player.status === "suspended") return { error: `@${player.handle} is already suspended` };
    if (typedHandle?.trim() !== player.handle) return { error: `Type @${player.handle}'s handle exactly to suspend them` };
  }

  await setPlayerStatus(parsed.data.id, parsed.data.status);
  revalidatePath("/players");
  // A suspension also takes them out of the brackets they were in.
  revalidatePath("/tournaments", "layout");
  return { ok: true as const };
}
