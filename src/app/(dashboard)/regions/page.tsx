import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getPlayers, getRegions, getTournaments } from "@/lib/api/competition";
import { formatCount } from "@/lib/format";
import { RegionsTable, type RegionRow } from "./regions-table";

export const metadata: Metadata = { title: "Regions" };

/**
 * The regions players pick from when they register, managed here so every
 * player and tournament is counted against one list: the dashboard's players
 * by region, the leagues, the tournament regions.
 */
export default async function RegionsPage() {
  const [regions, players, tournaments] = await Promise.all([getRegions(), getPlayers(), getTournaments()]);
  const rows: RegionRow[] = regions.map((r) => ({
    ...r,
    players: players.filter((p) => p.region === r.id).length,
    tournaments: tournaments.filter((t) => t.region === r.id).length,
  }));
  const active = regions.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader
        title="Regions"
        description="The list players choose their region from when they register. Tournaments are set to one of these, or Global."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active regions" value={formatCount(active)} footer="Offered at registration" />
        <StatCard label="Archived" value={formatCount(regions.length - active)} footer="Kept for existing players" />
        <StatCard label="Players placed" value={formatCount(players.filter((p) => regions.some((r) => r.id === p.region)).length)} footer={`of ${formatCount(players.length)} registered`} />
      </div>

      <SectionHeader title="All regions" />
      <RegionsTable rows={rows} />
    </>
  );
}
