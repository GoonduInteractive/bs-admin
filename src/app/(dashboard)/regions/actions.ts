"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createRegion, deleteRegion, getPlayers, getRegions, getTournaments, renameRegion, setRegionStatus } from "@/lib/api/competition";
import { failureMessage } from "@/lib/api/client";
import { findRegionPin, type FoundPin } from "@/lib/geocode";
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

/**
 * Add a region, or edit one. Renaming changes the name everywhere; players and
 * tournaments keep pointing at it. A pin left blank on an edit stays as it was.
 */
export async function saveRegionAction(id: string | null, input: RegionInput) {
  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name" };
  const name = parsed.data.name.replace(/\s+/g, " ");
  const pin = parsed.data.lat === "" ? null : { lat: Number(parsed.data.lat), lng: Number(parsed.data.lng) };

  try {
    const regions = await getRegions();
    const clash = regions.find((r) => sameName(r.name, name) && r.id !== id);
    if (clash) return { error: `There's already a region called ${clash.name}${clash.status === "archived" ? " (archived: restore it instead)" : ""}` };
    if (sameName(name, "Global")) return { error: "Global is reserved for tournaments open to every region" };
    if (id && !regions.some((r) => r.id === id)) return { error: "That region no longer exists" };

    if (id) {
      const region = await renameRegion(id, name, pin);
      refresh();
      return { ok: true as const, region };
    }
    const region = await createRegion(name, pin);
    refresh();
    return { ok: true as const, region };
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the region") };
  }
}

/**
 * The map pin for a region's name (`findRegionPin`): OpenStreetMap, searched
 * within Nigeria. Reads nothing of ours and changes nothing.
 */
export async function findRegionPinAction(name: string): Promise<{ pin: FoundPin } | { notFound: true } | { error: string }> {
  const parsed = z.string().trim().min(2).max(40).safeParse(name);
  if (!parsed.success) return { notFound: true };
  try {
    const pin = await findRegionPin(parsed.data);
    return pin ? { pin } : { notFound: true };
  } catch {
    return { error: "Couldn't look that place up just now. Type the coordinates, or try again." };
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
