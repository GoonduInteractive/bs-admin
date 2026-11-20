"use client";

import { Check, ShieldAlert, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { noteRuleLabel, type Tone } from "@/lib/labels";
import type { ModerationReport } from "@/types";
import { reviewReportAction } from "./actions";

const STATUS: Record<ModerationReport["status"], { label: string; tone: Tone }> = {
  open: { label: "Needs follow-up", tone: "warning" },
  reviewed: { label: "Followed up", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

const who = (r: ModerationReport) => (r.author.handle ? `@${r.author.handle}` : r.author.name);
const rulesOf = (r: ModerationReport) => [...new Set(r.rules.map(noteRuleLabel))].join(", ") || "—";

function ReportActions({ r }: { r: ModerationReport }) {
  const [pending, start] = useTransition();
  if (r.status !== "open") return null;
  const act = (action: "reviewed" | "dismissed") =>
    start(async () => {
      const res = await reviewReportAction(r.id, action);
      if ("error" in res) toast.error(res.error);
      else toast.success(action === "reviewed" ? `Marked as followed up: ${who(r)}` : `Dismissed: ${who(r)}'s report`);
    });
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="icon-sm"
        variant="outline"
        className="bg-card text-moss hover:bg-moss-soft hover:text-moss"
        disabled={pending}
        onClick={() => act("reviewed")}
        aria-label={`Mark ${who(r)}'s report as followed up`}
        title="Followed up"
      >
        <Check />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        className="bg-card text-muted-foreground hover:bg-paper"
        disabled={pending}
        onClick={() => act("dismissed")}
        aria-label={`Dismiss ${who(r)}'s report`}
        title="Dismiss"
      >
        <X />
      </Button>
    </div>
  );
}

/**
 * What the website refused to post and reported (self-harm, underage): the
 * note never went up, so there's nothing to restore. Each one is someone to
 * follow up with personally - self-harm first - then mark as followed up, or
 * dismiss. No frame draws it; the notes table's own shape.
 */
export function ReportsTable({ reports }: { reports: ModerationReport[] }) {
  const columns: Column<ModerationReport>[] = [
    {
      id: "note",
      header: "What they tried to post",
      cell: (r) => <span className="line-clamp-2 max-w-md min-w-56 whitespace-normal">{r.body}</span>,
      csv: (r) => r.body,
    },
    { id: "player", header: "Player", cell: (r) => <span className="font-medium">{who(r)}</span>, sortValue: who, csv: who },
    {
      id: "rules",
      header: "Matched",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {r.urgent && r.status === "open" && <StatusBadge label="Urgent" tone="danger" hint="Self-harm: reach out to the player personally." />}
          <span className="text-sm">{rulesOf(r)}</span>
        </span>
      ),
      sortValue: rulesOf,
      csv: rulesOf,
    },
    {
      id: "reported",
      header: "Reported",
      cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.reportedAt)}</span>,
      sortValue: (r) => r.reportedAt,
      csv: (r) => r.reportedAt,
    },
    { id: "status", header: "Status", cell: (r) => <StatusBadge {...STATUS[r.status]} />, sortValue: (r) => r.status, csv: (r) => STATUS[r.status].label },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (r) => <ReportActions r={r} /> },
  ];
  const filters: Filter<ModerationReport>[] = [
    { id: "status", label: "Status", options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), predicate: (r, v) => r.status === v },
  ];

  return (
    <DataTable
      rows={reports}
      columns={columns}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.body} ${r.author.handle ?? ""} ${r.author.name} ${rulesOf(r)}`}
      searchPlaceholder="Search reports or players…"
      filters={filters}
      exportName="note-reports"
      exportTitle="Notes the website blocked and reported"
      empty={{ icon: ShieldAlert, title: "No reports", description: "Notes the website refuses for self-harm or age appear here." }}
    />
  );
}
