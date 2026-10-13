import type { Region } from "@/types";
import { daysAgo } from "./random";

/**
 * The regions, as an admin would have set them up. The ids are the codes the
 * public site already uses (`TournamentRegion` there), so the two agree when
 * the site reads this list. Mutable: the mock adapters write to it.
 */
export const REGIONS: Region[] = [
  { id: "lagos", slug: "lagos", name: "Lagos", status: "active", createdAt: daysAgo(120) },
  { id: "southEast", slug: "south-east", name: "South East", status: "active", createdAt: daysAgo(120) },
  { id: "abuja", slug: "abuja", name: "Abuja", status: "active", createdAt: daysAgo(120) },
  { id: "rivers", slug: "rivers", name: "Rivers", status: "active", createdAt: daysAgo(90) },
  { id: "ghana", slug: "ghana", name: "Ghana", status: "active", createdAt: daysAgo(60) },
];
