"use client";

import { faCrown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UserX, Users } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { type Tone } from "@/lib/labels";
import { regionName } from "@/lib/regions";
import type { Participant } from "@/types";
import { disqualifyAction } from "../actions";

const STATUS: Record<Participant["status"], { label: string; tone: Tone }> = {
  registered: { label: "Registered", tone: "neutral" },
  active: { label: "Still in", tone: "success" },
  eliminated: { label: "Eliminated", tone: "danger" },
  champion: { label: "Champion", tone: "brand" },
};

function Disqualify({ slug, p }: { slug: string; p: Participant }) {
  const [pending, start] = useTransition();
  if (p.status === "eliminated" || p.status === "champion") return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-flare hover:bg-flare-soft hover:text-flare" disabled={pending}>
          <UserX />
          Disqualify
        </Button>
      }
      title={`Disqualify @${p.handle}?`}
      description="They're removed from the tournament and forfeit any match in progress. Use this for rule breaks and no-shows. It can't be undone from here."
      confirmLabel="Disqualify"
      destructive
      // Typing the handle makes sure it's this player and not the row above or below.
      confirmText={p.handle}
      onConfirm={(typed) =>
        start(async () => {
          const res = await disqualifyAction(slug, p.playerId, typed);
          if ("error" in res) toast.error(res.error);
          else toast.success(`@${p.handle} disqualified`);
        })
      }
    />
  );
}

export function Participants({
  slug,
  name,
  participants,
  names,
}: {
  slug: string;
  name: string;
  participants: Participant[];
  /** Region id -> name, from the Regions list. */
  names: Record<string, string>;
}) {
  const columns: Column<Participant>[] = [
    { id: "seed", header: "Seed", cell: (p) => <span className="text-muted-foreground tabular">#{p.seed}</span>, sortValue: (p) => p.seed, csv: (p) => p.seed, className: "w-16" },
    {
      id: "handle",
      header: "Player",
      cell: (p) => (
        <span className="font-medium">
          {p.status === "champion" && <FontAwesomeIcon icon={faCrown} className="mr-1.5 text-gold" aria-hidden />}@{p.handle}
        </span>
      ),
      sortValue: (p) => p.handle,
      csv: (p) => p.handle,
    },
    { id: "region", header: "Region", cell: (p) => regionName(p.region, names), sortValue: (p) => regionName(p.region, names), csv: (p) => regionName(p.region, names) },
    { id: "points", header: "Points", cell: (p) => <span className="tabular">{p.points.toLocaleString("en-NG")}</span>, sortValue: (p) => p.points, csv: (p) => p.points },
    { id: "status", header: "Status", cell: (p) => <StatusBadge {...STATUS[p.status]} />, sortValue: (p) => p.status, csv: (p) => STATUS[p.status].label },
    { id: "registered", header: "Registered", cell: (p) => formatDate(p.registeredAt), sortValue: (p) => p.registeredAt, csv: (p) => p.registeredAt },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (p) => <Disqualify slug={slug} p={p} />, className: "text-right" },
  ];

  const filters: Filter<Participant>[] = [
    {
      id: "status",
      label: "Status",
      options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
      predicate: (p, v) => p.status === v,
    },
  ];

  return (
    <DataTable
      rows={participants}
      columns={columns}
      getRowId={(p) => p.playerId}
      searchText={(p) => p.handle}
      searchPlaceholder="Search handle…"
      filters={filters}
      exportName={`${slug}-players`}
      exportTitle={`${name}: players`}
      empty={{ icon: Users, title: "No players yet", description: "Players appear here as they register." }}
    />
  );
}
