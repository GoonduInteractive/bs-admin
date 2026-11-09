import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { getRegions, getTournamentStats, getTournaments } from "@/lib/api/competition";
import { regionNames } from "@/lib/regions";
import { formatCount, formatNairaCompact } from "@/lib/format";
import { TournamentsTable } from "./tournaments-table";

export const metadata: Metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  const [tournaments, regions, stats] = await Promise.all([getTournaments(), getRegions(), getTournamentStats()]);
  const live = tournaments.filter((t) => t.status === "active");
  const open = tournaments.filter((t) => t.status === "registrationOpen");

  return (
    <>
      <PageHeader
        title="Tournaments"
        description="Regional leagues and seasonal events. Tournaments roll out from October 2026, Nigeria-first."
        actions={
          <Button size="xl" render={<Link href="/tournaments/new" />}>
            <Plus />
            New tournament
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live now" value={formatCount(live.length)} tone="success" footer={live.map((t) => t.name).join(", ") || "None running"} />
        <StatCard label="Taking registrations" value={formatCount(open.length)} footer={`${formatCount(open.reduce((s, t) => s + t.slots.taken, 0))} players signed up`} />
        {/* The prize figures are the API's own sums (`/stats`). */}
        <StatCard label="Prize money committed" value={formatNairaCompact(stats.committed)} footer="Live, open and announced" />
        <StatCard
          label="Prize money awarded"
          value={formatNairaCompact(stats.awarded ?? tournaments.filter((t) => t.status === "completed").reduce((s, t) => s + t.prizePool, 0))}
          footer="Completed tournaments"
        />
      </div>

      <SectionHeader title="All tournaments" />
      <TournamentsTable tournaments={tournaments} names={regionNames(regions)} />
    </>
  );
}
