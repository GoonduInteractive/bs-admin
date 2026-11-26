"use client";

import { ExternalLink, Landmark } from "lucide-react";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { formatDateTime, formatHbar } from "@/lib/format";
import { hashscanUrl } from "@/lib/hedera/links";
import { MOVEMENT_KIND } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { HederaNetwork, TreasuryMovement } from "@/types/hedera";

/** Every movement on the treasury account, newest first: what came in, what went out. */
export function MovementsTable({ rows, network }: { rows: TreasuryMovement[]; network: HederaNetwork }) {
  const columns: Column<TreasuryMovement>[] = [
    { id: "at", header: "When", cell: (m) => <span className="text-muted-foreground">{formatDateTime(m.at)}</span>, sortValue: (m) => m.at, csv: (m) => m.at },
    { id: "kind", header: "Kind", cell: (m) => MOVEMENT_KIND[m.kind], sortValue: (m) => m.kind, csv: (m) => MOVEMENT_KIND[m.kind] },
    { id: "label", header: "What", cell: (m) => m.label, csv: (m) => m.label },
    {
      id: "hbar",
      header: "HBAR",
      cell: (m) => (
        <span className={cn("font-medium tabular", m.hbar > 0 ? "text-moss" : "text-foreground")}>
          {m.hbar > 0 ? "+" : "−"}
          {formatHbar(Math.abs(m.hbar))}
        </span>
      ),
      sortValue: (m) => m.hbar,
      csv: (m) => m.hbar,
      pdf: (m) => `${m.hbar > 0 ? "+" : "-"}${formatHbar(Math.abs(m.hbar))}`,
      className: "text-right",
      headClassName: "text-right",
    },
    {
      id: "tx",
      header: "Transaction",
      cell: (m) =>
        m.txId ? (
          <a href={hashscanUrl(network, "transaction", m.txId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-signal hover:underline">
            {m.txId.split("@")[1]}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Rolled up</span>
        ),
      csv: (m) => m.txId ?? "",
    },
  ];
  const filters: Filter<TreasuryMovement>[] = [
    {
      id: "kind",
      label: "Kind",
      options: Object.entries(MOVEMENT_KIND).map(([value, label]) => ({ value, label })),
      predicate: (m, v) => m.kind === v,
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(m) => m.id}
      searchText={(m) => `${m.label} ${m.txId ?? ""}`}
      searchPlaceholder="Search movements…"
      filters={filters}
      exportName="treasury-movements"
      exportTitle="Treasury movements"
      empty={{ icon: Landmark, title: "No movements yet", description: "Sales, payouts and refunds on the treasury account show up here." }}
    />
  );
}
