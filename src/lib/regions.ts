import type { Region, RegionId } from "@/types";

/**
 * Regions are a list admins manage (Regions in the sidebar). These helpers
 * turn a stored id into the name to show.
 */

/** A tournament open to every region. Not a region itself: it can't be renamed or archived. */
export const GLOBAL_REGION = "global";

/** id -> name, for tables and cards. Archived regions keep their name. */
export function regionNames(regions: readonly Region[]): Record<RegionId, string> {
  return Object.fromEntries(regions.map((r) => [r.id, r.name]));
}

/** "Lagos"; "Global" for an open tournament; "Unknown region" if the region was deleted. */
export function regionName(id: RegionId, names: Record<RegionId, string>): string {
  if (id === GLOBAL_REGION) return "Global";
  return names[id] ?? "Unknown region";
}
