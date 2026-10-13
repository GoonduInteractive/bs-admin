import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getPlayers, getRegions } from "@/lib/api/competition";
import { formatCount } from "@/lib/format";
import { DAY, MOCK_NOW } from "@/lib/mock/random";
import { PlayersTable } from "./players-table";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const { q } = await searchParams;
  const [players, regions] = await Promise.all([getPlayers(), getRegions()]);
  // MOCK_NOW keeps "last 7 days" consistent with the fixtures; use Date.now() on real data.
  const activeWeek = players.filter((p) => new Date(p.lastActiveAt).getTime() > MOCK_NOW - 7 * DAY).length;

  return (
    <>
      <PageHeader title="Players" description="Everyone signed up to Beyond Service, their standing, and account controls." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered players" value={formatCount(players.length)} />
        <StatCard label="Active this week" value={formatCount(activeWeek)} tone="success" footer={`${Math.round((activeWeek / players.length) * 100)}% of all players`} />
        <StatCard label="Unverified" value={formatCount(players.filter((p) => p.status === "unverified").length)} tone="warning" footer="Haven't confirmed their email" />
        <StatCard label="Suspended" value={formatCount(players.filter((p) => p.status === "suspended").length)} tone="danger" />
      </div>

      <SectionHeader title="All players" />
      <PlayersTable players={players} regions={regions} initialQuery={typeof q === "string" ? q : undefined} />
    </>
  );
}
