"use server";

import { revalidatePath } from "next/cache";
import { deleteRegion, getPlayers, getRegions, getTournaments, saveRegion } from "@/lib/api/competition";
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

  const regions = await getRegions();
  const clash = regions.find((r) => sameName(r.name, name) && r.id !== id);
  if (clash) return { error: `There's already a region called ${clash.name}${clash.status === "archived" ? " (archived: restore it instead)" : ""}` };
  if (sameName(name, "Global")) return { error: "Global is reserved for tournaments open to every region" };

  const existing = id ? regions.find((r) => r.id === id) : undefined;
  if (id && !existing) return { error: "That region no longer exists" };

  const region: Region = existing
    ? { ...existing, name }
    : { id: `reg_${crypto.randomUUID().slice(0, 8)}`, name, status: "active", createdAt: new Date().toISOString() };
  await saveRegion(region);
  refresh();
  return { ok: true as const, region };
}

/**
 * Archive or restore. Archived regions stop being offered to new players and
 * new tournaments; everyone already in one keeps it.
 */
export async function setRegionStatusAction(id: string, status: Region["status"]) {
  const region = (await getRegions()).find((r) => r.id === id);
  if (!region) return { error: "That region no longer exists" };
  await saveRegion({ ...region, status });
  refresh();
  return { ok: true as const };
}

/** Only a region nobody uses can be deleted; one in use is archived instead, so no player or tournament loses its region. */
export async function deleteRegionAction(id: string) {
  const [players, tournaments] = await Promise.all([getPlayers(), getTournaments()]);
  const inUse = players.filter((p) => p.region === id).length + tournaments.filter((t) => t.region === id).length;
  if (inUse) return { error: "Players or tournaments use this region. Archive it instead." };
  await deleteRegion(id);
  refresh();
  return { ok: true as const };
}
