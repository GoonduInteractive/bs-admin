"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatDateTime, formatNaira } from "@/lib/format";
import { PAYMENT_METHOD, TRANSACTION_STATUS, TRANSACTION_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

export type RelatedLinks = Record<string, { label: string; href: string }>;

function Amount({ t, className }: { t: Transaction; className?: string }) {
  return (
    <span className={cn("font-medium tabular", t.direction === "out" && "text-flare", className)}>
      {t.direction === "out" ? "−" : "+"}
      {formatNaira(t.amount)}
    </span>
  );
}

const columns: Column<Transaction>[] = [
  {
    id: "reference",
    header: "Reference",
    cell: (t) => (
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            t.direction === "in" ? "bg-moss-soft text-moss" : "bg-flare-soft text-flare",
          )}
          aria-label={t.direction === "in" ? "Money in" : "Money out"}
        >
          {t.direction === "in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </span>
        <span className="font-medium">{t.reference}</span>
      </span>
    ),
    sortValue: (t) => t.reference,
    csv: (t) => t.reference,
  },
  {
    id: "type",
    header: "Type",
    cell: (t) => TRANSACTION_TYPE[t.type],
    sortValue: (t) => t.type,
    csv: (t) => TRANSACTION_TYPE[t.type],
  },
  {
    id: "party",
    header: "Customer / payee",
    cell: (t) => (
      <div>
        <p>{t.party.name}</p>
        <p className="text-xs text-muted-foreground">{t.party.email}</p>
      </div>
    ),
    sortValue: (t) => t.party.name,
    csv: (t) => t.party.name,
  },
  {
    id: "method",
    header: "Method",
    cell: (t) => <span className="text-muted-foreground">{PAYMENT_METHOD[t.method]}</span>,
    csv: (t) => PAYMENT_METHOD[t.method],
  },
  {
    id: "amount",
    header: "Amount",
    cell: (t) => <Amount t={t} />,
    sortValue: (t) => (t.direction === "out" ? -t.amount : t.amount),
    csv: (t) => (t.direction === "out" ? -t.amount : t.amount),
    pdf: (t) => `${t.direction === "out" ? "-" : "+"}${formatNaira(t.amount)}`,
  },
  {
    id: "status",
    header: "Status",
    cell: (t) => <StatusBadge {...TRANSACTION_STATUS[t.status]} />,
    sortValue: (t) => t.status,
    csv: (t) => TRANSACTION_STATUS[t.status].label,
  },
  {
    id: "date",
    header: "Date",
    cell: (t) => <span className="whitespace-nowrap">{formatDate(t.createdAt)}</span>,
    sortValue: (t) => t.createdAt,
    csv: (t) => t.createdAt,
  },
];

const filters: Filter<Transaction>[] = [
  {
    id: "type",
    label: "Type",
    options: Object.entries(TRANSACTION_TYPE).map(([value, label]) => ({ value, label })),
    predicate: (t, v) => t.type === v,
  },
  {
    id: "status",
    label: "Status",
    options: Object.entries(TRANSACTION_STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (t, v) => t.status === v,
  },
  {
    id: "method",
    label: "Method",
    options: Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label })),
    predicate: (t, v) => t.method === v,
  },
  {
    id: "direction",
    label: "Direction",
    options: [
      { value: "in", label: "Money in" },
      { value: "out", label: "Money out" },
    ],
    predicate: (t, v) => t.direction === v,
  },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function TransactionSheet({
  txn,
  related,
  onClose,
}: {
  txn: Transaction | null;
  related: RelatedLinks;
  onClose: () => void;
}) {
  const link = txn?.relatedId ? related[txn.relatedId] : undefined;

  return (
    <Sheet open={!!txn} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {txn && (
          <>
            <SheetHeader className="border-b p-6">
              <SheetDescription>{TRANSACTION_TYPE[txn.type]}</SheetDescription>
              <SheetTitle className="text-3xl font-semibold">
                <Amount t={txn} className="text-foreground" />
              </SheetTitle>
              <div className="pt-1">
                <StatusBadge {...TRANSACTION_STATUS[txn.status]} />
              </div>
            </SheetHeader>

            <dl className="divide-y px-6">
              <Row label="Reference">{txn.reference}</Row>
              <Row label="Date">{formatDateTime(txn.createdAt)}</Row>
              <Row label="Method">{PAYMENT_METHOD[txn.method]}</Row>
              <Row label={txn.direction === "in" ? "Paid by" : "Paid to"}>
                {txn.party.name}
                <span className="block text-xs text-muted-foreground">{txn.party.email}</span>
              </Row>
              <Row label="Processor fee">{txn.fee ? formatNaira(txn.fee) : "—"}</Row>
              <Row label="Net">
                <span className="font-medium tabular">{formatNaira(txn.amount - txn.fee)}</span>
              </Row>
              {link && (
                <Row label="For">
                  <Link href={link.href} className="inline-flex items-center gap-1 text-signal hover:underline">
                    {link.label}
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Row>
              )}
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function TransactionsTable({ transactions, related }: { transactions: Transaction[]; related: RelatedLinks }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Look the row up fresh so the sheet reflects a status change after revalidation.
  const open = transactions.find((t) => t.id === openId) ?? null;

  return (
    <>
      <DataTable
        rows={transactions}
        columns={columns}
        getRowId={(t) => t.id}
        onRowClick={(t) => setOpenId(t.id)}
        searchText={(t) => `${t.reference} ${t.party.name} ${t.party.email}`}
        searchPlaceholder="Search reference, name or email…"
        filters={filters}
        exportName="transactions"
        exportTitle="Transactions"
        empty={{ icon: ArrowLeftRight, title: "No transactions", description: "Payments, refunds and payouts will appear here." }}
      />
      <TransactionSheet txn={open} related={related} onClose={() => setOpenId(null)} />
    </>
  );
}
