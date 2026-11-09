"use server";

import { revalidatePath } from "next/cache";
import { createRegion, deleteRegion, getPlayers, getRegions, getTournaments, renameRegion, setRegionStatus } from "@/lib/api/competition";
import { failureMessage } from "@/lib/api/client";
import { isRegion } from "@/lib/regions";
import { regionSchema, type RegionInput } from "@/lib/schemas";
import type { Region } from "@/types";

function refresh() {
  revalidatePath("/regions");
  revalidatePath("/players");
  revalidatePath("/tournaments");
  revalidatePath("/");
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Add a region, or rename one. Renaming changes the name everywhere; players and tournaments keep pointing at it. */
export async function saveRegionAction(id: string | null, input: RegionInput) {
  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name" };
  const name = parsed.data.name.replace(/\s+/g, " ");

  try {
    const regions = await getRegions();
    const clash = regions.find((r) => sameName(r.name, name) && r.id !== id);
    if (clash) return { error: `There's already a region called ${clash.name}${clash.status === "archived" ? " (archived: restore it instead)" : ""}` };
    if (sameName(name, "Global")) return { error: "Global is reserved for tournaments open to every region" };
    if (id && !regions.some((r) => r.id === id)) return { error: "That region no longer exists" };

    const region = id ? await renameRegion(id, name) : await createRegion(name);
    refresh();
    return { ok: true as const, region };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the region") };
  }
}

/**
 * Archive or restore. Archived regions stop being offered to new players and
 * new tournaments; everyone already in one keeps it.
 */
export async function setRegionStatusAction(id: string, status: Region["status"]) {
  try {
    const region = (await getRegions()).find((r) => r.id === id);
    if (!region) return { error: "That region no longer exists" };
    await setRegionStatus(region, status);
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the region") };
  }
}

/** Only a region nobody uses can be deleted; one in use is archived instead, so no player or tournament loses its region. */
export async function deleteRegionAction(id: string) {
  try {
    const [regions, players, tournaments] = await Promise.all([getRegions(), getPlayers(), getTournaments()]);
    const region = regions.find((r) => r.id === id);
    if (!region) return { error: "That region no longer exists" };
    const inUse = players.filter((p) => isRegion(region, p.region)).length + tournaments.filter((t) => isRegion(region, t.region)).length;
    if (inUse) return { error: "Players or tournaments use this region. Archive it instead." };
    await deleteRegion();
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't delete the region") };
  }
}
