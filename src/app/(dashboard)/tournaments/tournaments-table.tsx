"use client";

import { Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatNaira, formatNairaCompact } from "@/lib/format";
import { TOURNAMENT_STATUS } from "@/lib/labels";
import { regionName } from "@/lib/regions";
import { slotsFill } from "@/lib/tournaments";
import type { Tournament } from "@/types";

function dates(t: Tournament) {
  if (!t.startsAt) return <span className="text-muted-foreground">Dates TBC</span>;
  return (
    <span className="whitespace-nowrap">
      {formatDate(t.startsAt)}
      {t.endsAt && <span className="block text-xs text-muted-foreground">to {formatDate(t.endsAt)}</span>}
    </span>
  );
}

function columnsFor(names: Record<string, string>): Column<Tournament>[] {
  return [
  {
    id: "name",
    header: "Tournament",
    cell: (t) => (
      <Link href={`/tournaments/${t.slug}`} className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-entry text-signal">
          <Trophy className="size-4.5" />
        </span>
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            {t.name}
            {t.featured && <Star className="size-3.5 fill-amber text-amber" aria-label="Featured" />}
          </span>
          <span className="block text-xs text-muted-foreground">{regionName(t.region, names)} · 1v1</span>
        </span>
      </Link>
    ),
    sortValue: (t) => t.name,
    csv: (t) => t.name,
  },
  {
    id: "status",
    header: "Status",
    cell: (t) => <StatusBadge {...TOURNAMENT_STATUS[t.status]} />,
    sortValue: (t) => t.status,
    csv: (t) => TOURNAMENT_STATUS[t.status].label,
  },
  {
    id: "dates",
    header: "Dates",
    cell: dates,
    sortValue: (t) => t.startsAt ?? "9999",
    csv: (t) => t.startsAt ?? "",
  },
  {
    id: "players",
    header: "Players",
    cell: (t) => {
      const pct = slotsFill(t);
      return (
        <div className="w-32">
          <p className="text-sm tabular">
            {t.slots.taken} <span className="text-muted-foreground">/ {t.slots.total ?? "∞"}</span>
          </p>
          {pct === null ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Unlimited slots</p>
          ) : (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-soft" role="presentation">
              <div className="h-full rounded-full bg-crimson" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      );
    },
    sortValue: (t) => t.slots.taken,
    csv: (t) => `${t.slots.taken}/${t.slots.total ?? "Unlimited"}`,
  },
  {
    id: "prize",
    header: "Prize pool",
    cell: (t) => <span className="tabular">{formatNairaCompact(t.prizePool)}</span>,
    sortValue: (t) => t.prizePool,
    csv: (t) => t.prizePool,
    pdf: (t) => formatNaira(t.prizePool),
  },
  ];
}

/** The region filter offers the regions tournaments actually use, named from the Regions list. */
function filtersFor(tournaments: Tournament[], names: Record<string, string>): Filter<Tournament>[] {
  const regions = [...new Set(tournaments.map((t) => t.region))]
    .map((id) => ({ value: id, label: regionName(id, names) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [
    {
      id: "status",
      label: "Status",
      options: Object.entries(TOURNAMENT_STATUS).map(([value, s]) => ({ value, label: s.label })),
      predicate: (t, v) => t.status === v,
    },
    {
      id: "region",
      label: "Region",
      options: regions,
      predicate: (t, v) => t.region === v,
    },
  ];
}

export function TournamentsTable({ tournaments, names }: { tournaments: Tournament[]; names: Record<string, string> }) {
  const filters = useMemo(() => filtersFor(tournaments, names), [tournaments, names]);
  const columns = useMemo(() => columnsFor(names), [names]);
  return (
    <DataTable
      rows={tournaments}
      columns={columns}
      getRowId={(t) => t.id}
      rowHref={(t) => `/tournaments/${t.slug}`}
      searchText={(t) => `${t.name} ${regionName(t.region, names)}`}
      searchPlaceholder="Search tournaments…"
      filters={filters}
      exportName="tournaments"
      exportTitle="Tournaments"
      empty={{ icon: Trophy, title: "No tournaments yet", description: "Create the first one to open registration." }}
    />
  );
}
