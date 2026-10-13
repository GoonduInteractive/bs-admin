import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getPlayerStats, getPlayers, getRegions } from "@/lib/api/competition";
import { formatCount } from "@/lib/format";
import { PlayersTable } from "./players-table";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const { q } = await searchParams;
  const [players, stats, regions] = await Promise.all([getPlayers(), getPlayerStats(), getRegions()]);
  const activeShare = stats.total ? Math.round((stats.activeThisWeek / stats.total) * 100) : 0;

  return (
    <>
      <PageHeader title="Players" description="Everyone signed up to Beyond Service, their standing, and account controls." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered players" value={formatCount(stats.total)} />
        <StatCard label="Active this week" value={formatCount(stats.activeThisWeek)} tone="success" footer={`${activeShare}% of all players`} />
        <StatCard label="Unverified" value={formatCount(stats.unverified)} tone="warning" footer="Haven't confirmed their email" />
        <StatCard label="Suspended" value={formatCount(stats.suspended)} tone="danger" />
      </div>

      <SectionHeader title="All players" />
      <PlayersTable players={players} regions={regions} initialQuery={typeof q === "string" ? q : undefined} />
    </>
  );
}
