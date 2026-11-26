"use client";

import { ExternalLink, ListRestart, Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatDateTime, formatHbar, formatTime } from "@/lib/format";
import { hashscanUrl } from "@/lib/hedera/links";
import { jobActions, refundAmount } from "@/lib/hedera/payouts";
import { JOB_ACTION, JOB_KIND, JOB_PROBLEM, JOB_STATUS } from "@/lib/labels";
import type { HederaJob, HederaNetwork, JobAction } from "@/types/hedera";
import { actOnJobAction } from "../actions";

/** What the action does, in a line, for the button's confirm. */
function consequence(job: HederaJob, action: JobAction): { title: string; body: string } {
  const who = `@${job.player.handle}`;
  if (action === "refund") {
    return {
      title: `Refund ${formatHbar(refundAmount(job))} to ${who}?`,
      body: `It goes from the treasury back to ${job.wallet}, the wallet it came from, and closes ${job.reference}. HBAR sent on Hedera can't be pulled back.`,
    };
  }
  if (action === "recheck") {
    return {
      title: `Check ${job.reference} on the Mirror Node again?`,
      body: "If the payment is there with the order's memo and amount, the order is confirmed and the exclusive goes into the mint queue.",
    };
  }
  if (job.kind === "payout") {
    return {
      title: `Retry the ${formatHbar(job.hbar ?? 0)} payout to ${who}?`,
      body: `It goes to ${job.wallet}, their verified wallet, with the same idempotency key, so it can't be paid twice.`,
    };
  }
  return {
    title: `Retry the mint for ${job.reference}?`,
    body: `${job.item} goes back into the mint queue with the same idempotency key, so it can't be minted twice.`,
  };
}

function ActionButtons({ job, size = "sm" }: { job: HederaJob; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<JobAction | null>(null);
  const actions = jobActions(job);
  if (job.status === "working") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {JOB_ACTION[job.working!.action].working}…
      </span>
    );
  }
  if (!actions.length) return null;
  const said = asking ? consequence(job, asking) : null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {actions.map((a) => (
        <Button
          key={a}
          size={size}
          variant={a === "refund" && actions.length > 1 ? "outline" : "default"}
          disabled={pending}
          aria-label={`${JOB_ACTION[a].label}: ${job.reference}`}
          onClick={() => setAsking(a)}
        >
          {JOB_ACTION[a].label}
        </Button>
      ))}
      <ConfirmDialog
        open={!!asking}
        onOpenChange={(o) => !o && setAsking(null)}
        title={said?.title ?? ""}
        description={said?.body ?? ""}
        confirmLabel={asking ? JOB_ACTION[asking].label : ""}
        onConfirm={() => {
          const action = asking!;
          start(async () => {
            const res = await actOnJobAction(job.id, action);
            if ("error" in res) toast.error(res.error);
            else toast.success(`${JOB_ACTION[action].working}: ${job.reference}`);
          });
        }}
      />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm wrap-break-word">{children}</dd>
    </div>
  );
}

function Tx({ network, txId }: { network: HederaNetwork; txId: string }) {
  return (
    <a href={hashscanUrl(network, "transaction", txId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs break-all text-signal hover:underline">
      {txId}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

function JobDetail({ job, network }: { job: HederaJob; network: HederaNetwork }) {
  return (
    <>
      <SheetHeader className="border-b p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge {...JOB_PROBLEM[job.problem]} />
          <StatusBadge {...JOB_STATUS[job.status]} />
        </div>
        <SheetTitle className="mt-2 text-lg">{job.item}</SheetTitle>
        <SheetDescription>
          {JOB_KIND[job.kind]} · {job.reference} · @{job.player.handle}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <p className="rounded-lg bg-paper px-3 py-2 font-mono text-xs leading-relaxed">{job.lastError}</p>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Player">
            {job.player.name} (@{job.player.handle})
          </Fact>
          <Fact label="Wallet">
            <a href={hashscanUrl(network, "account", job.wallet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:underline">
              {job.wallet}
              <ExternalLink className="size-3" />
            </a>
          </Fact>
          {job.hbar !== null && <Fact label={job.kind === "payout" ? "Prize" : "Quoted"}>{formatHbar(job.hbar)}</Fact>}
          {job.paidHbar !== undefined && <Fact label="Arrived">{formatHbar(job.paidHbar)}</Fact>}
          <Fact label="Attempts">{job.attempts}</Fact>
          <Fact label="First failed">{formatDateTime(job.createdAt)}</Fact>
          <Fact label="Idempotency key">
            <span className="font-mono text-xs">{job.idempotencyKey}</span>
          </Fact>
          {job.via && <Fact label="For">{job.via === "purchase" ? "A purchase: refund if it can't mint" : "A free claim"}</Fact>}
        </dl>
        {job.txId && (
          <div>
            <p className="text-xs text-muted-foreground">{job.kind === "payment" || job.via === "purchase" ? "The player's payment" : "Transaction"}</p>
            <Tx network={network} txId={job.txId} />
          </div>
        )}
        {job.resolution && (
          <div className="rounded-lg bg-moss-soft px-3 py-2.5 text-sm text-moss">
            <p>
              {job.resolution.action === "paidManually" ? "Paid by hand from Payouts" : JOB_ACTION[job.resolution.action].done} by {job.resolution.by},{" "}
              {formatDateTime(job.resolution.at)}.
            </p>
            {job.resolution.txId && job.resolution.txId !== job.txId && (
              <div className="mt-1">
                <Tx network={network} txId={job.resolution.txId} />
              </div>
            )}
          </div>
        )}
        <div className="flex justify-start">
          <ActionButtons job={job} size="default" />
        </div>
        <p className="text-xs text-muted-foreground">Every transaction here, and the wallets in it, are public on Hedera.</p>
      </div>
    </>
  );
}

export function JobsTable({ rows, network }: { rows: HederaJob[]; network: HederaNetwork }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const columns: Column<HederaJob>[] = [
    {
      id: "problem",
      header: "Problem",
      cell: (j) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge {...JOB_PROBLEM[j.problem]} />
          <span className="text-xs text-muted-foreground">
            {JOB_KIND[j.kind]}
            {j.via ? ` · ${j.via === "purchase" ? "purchase" : "free claim"}` : ""}
          </span>
        </span>
      ),
      sortValue: (j) => j.problem,
      csv: (j) => JOB_PROBLEM[j.problem].label,
    },
    {
      id: "item",
      header: "For",
      cell: (j) => (
        <span>
          <span className="block font-medium">{j.item}</span>
          <span className="block font-mono text-xs text-muted-foreground">{j.reference}</span>
        </span>
      ),
      sortValue: (j) => j.item,
      csv: (j) => `${j.item} (${j.reference})`,
    },
    {
      id: "player",
      header: "Player",
      cell: (j) => (
        <span>
          <span className="block">@{j.player.handle}</span>
          <span className="block font-mono text-xs text-muted-foreground">{j.wallet}</span>
        </span>
      ),
      csv: (j) => `@${j.player.handle} ${j.wallet}`,
    },
    {
      id: "hbar",
      header: "HBAR",
      cell: (j) =>
        j.hbar === null ? (
          <span className="text-muted-foreground">Free</span>
        ) : (
          <span className="tabular whitespace-nowrap">
            {j.paidHbar !== undefined && j.paidHbar !== j.hbar ? (
              <>
                <span className="block">{formatHbar(j.paidHbar)}</span>
                <span className="block text-xs text-muted-foreground">of {formatHbar(j.hbar)}</span>
              </>
            ) : (
              formatHbar(j.hbar)
            )}
          </span>
        ),
      sortValue: (j) => j.hbar ?? 0,
      csv: (j) => j.hbar ?? "",
    },
    // In the sheet, and the export; the row has no room for a sentence.
    { id: "error", header: "Last error", cell: () => null, csv: (j) => j.lastError, exportOnly: true },
    { id: "attempts", header: "Tries", cell: (j) => <span className="tabular">{j.attempts}</span>, sortValue: (j) => j.attempts, csv: (j) => j.attempts },
    {
      id: "status",
      header: "Status",
      cell: (j) => <StatusBadge {...JOB_STATUS[j.status]} />,
      sortValue: (j) => j.status,
      csv: (j) => JOB_STATUS[j.status].label,
    },
    { id: "key", header: "Idempotency key", cell: () => null, csv: (j) => j.idempotencyKey, exportOnly: true },
    {
      id: "updated",
      header: "Updated",
      // The day over the time, so the action buttons stay on screen at 1440.
      cell: (j) => (
        <span className="whitespace-nowrap text-muted-foreground">
          <span className="block">{formatDate(j.updatedAt)}</span>
          <span className="block text-xs">{formatTime(j.updatedAt)}</span>
        </span>
      ),
      sortValue: (j) => j.updatedAt,
      csv: (j) => j.updatedAt,
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (j) => <ActionButtons job={j} />, className: "w-40 text-right" },
  ];

  const filters: Filter<HederaJob>[] = [
    {
      id: "status",
      label: "Status",
      options: Object.entries(JOB_STATUS).map(([value, s]) => ({ value, label: s.label })),
      predicate: (j, v) => j.status === v,
    },
    {
      id: "kind",
      label: "Kind",
      options: [
        { value: "mint", label: "Failed mints" },
        { value: "payment", label: "Stuck payments" },
        { value: "payout", label: "Failed payouts" },
      ],
      predicate: (j, v) => j.kind === v,
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(j) => j.id}
        onRowClick={(j) => setOpenId(j.id)}
        searchText={(j) => `${j.item} ${j.reference} ${j.player.handle} ${j.player.name} ${j.wallet} ${j.idempotencyKey}`}
        searchPlaceholder="Search by order, claim, player or wallet…"
        filters={filters}
        exportName="hedera-jobs"
        exportTitle="Hedera jobs"
        empty={{ icon: ListRestart, title: "Nothing stuck", description: "Failed mints, stuck payments and failed payouts show up here." }}
      />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">{open && <JobDetail key={open.id} job={open} network={network} />}</SheetContent>
      </Sheet>
    </>
  );
}
