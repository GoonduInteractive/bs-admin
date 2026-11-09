import type { Region, RegionId } from "@/types";

/**
 * Regions are a list admins manage (Regions in the sidebar). These helpers
 * turn a stored id into the name to show.
 */

/** A tournament open to every region. Not a region itself: it can't be renamed or archived. */
export const GLOBAL_REGION = "global";

/**
 * id -> name, for tables and cards. Archived regions keep their name. Keyed by
 * slug as well as id: the API's ids are uuids, but some replies (tournaments,
 * the dashboard) name a region by its slug.
 */
export function regionNames(regions: readonly Region[]): Record<RegionId, string> {
  return Object.fromEntries(regions.flatMap((r) => [[r.slug, r.name], [r.id, r.name]]));
}

/** "Lagos"; "Global" for an open tournament; "Unknown region" if the region was deleted. */
export function regionName(id: RegionId, names: Record<RegionId, string>): string {
  if (id === GLOBAL_REGION) return "Global";
  return names[id] ?? "Unknown region";
}

/** Whether a stored region id points at this region, by id or by slug. */
export function isRegion(region: Region, id: RegionId | undefined): boolean {
  return id === region.id || id === region.slug;
}
