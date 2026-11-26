"use client";

import { ExternalLink, HandCoins, Loader2, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatDateTime, formatHbar } from "@/lib/format";
import { hashscanUrl } from "@/lib/hedera/links";
import { ID_TYPE, IDENTITY_STATUS, PAYOUT_STATUS } from "@/lib/labels";
import { ordinal } from "@/lib/tournaments";
import type { HederaNetwork, IdentityStatus, PrizePayout } from "@/types/hedera";
import { approvePayoutAction, holdPayoutAction, rejectIdentityAction, releasePayoutAction, verifyIdentityAction } from "../actions";
import { ReasonDialog } from "../reason-dialog";
import { ManualPayoutDialog } from "./manual-payout-dialog";

export type PayoutRow = PrizePayout & { identityStatus: IdentityStatus; blocker: string | null };

/** "HashPack" or "Embedded wallet, Google sign-in". */
const walletKind = (w: NonNullable<PrizePayout["wallet"]>) => (w.door === "existing" ? w.provider : `Embedded wallet, ${w.provider} sign-in`);

/* ---- The sheet ---------------------------------------------------------- */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function TxLink({ network, txId }: { network: HederaNetwork; txId: string }) {
  return (
    <a href={hashscanUrl(network, "transaction", txId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs break-all text-signal hover:underline">
      {txId}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

function PayoutDetail({ p, network, free }: { p: PayoutRow; network: HederaNetwork; free: number }) {
  const [pending, start] = useTransition();
  const [approving, setApproving] = useState(false);
  const [holding, setHolding] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [payingByHand, setPayingByHand] = useState(false);
  const who = `@${p.player.handle}`;
  const run = (fn: () => Promise<{ ok: true } | { error: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast.error(res.error);
      else toast.success(done);
    });
  const short = p.status === "awaitingApproval" && !p.blocker && free < p.hbar;
  // The fallback when the automatic payout can't go: only to the verified wallet, once identity is cleared.
  const canPayByHand = (p.status === "failed" || p.status === "awaitingApproval") && !p.blocker;

  return (
    <>
      <SheetHeader className="border-b p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge {...PAYOUT_STATUS[p.status]} />
          <StatusBadge {...IDENTITY_STATUS[p.identityStatus]} label={`Identity: ${IDENTITY_STATUS[p.identityStatus].label}`} />
        </div>
        <SheetTitle className="mt-2 text-lg">
          {formatHbar(p.hbar)} to {p.player.name}
        </SheetTitle>
        <SheetDescription>
          {who} · {p.tournament.name}, {ordinal(p.place)} place
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="size-4 text-muted-foreground" />
            Wallet
          </h3>
          {p.wallet ? (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Fact label="Account">
                <a href={hashscanUrl(network, "account", p.wallet.accountId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:underline">
                  {p.wallet.accountId}
                  <ExternalLink className="size-3" />
                </a>
              </Fact>
              <Fact label="Kind">{walletKind(p.wallet)}</Fact>
              <Fact label="Linked">{formatDate(p.wallet.linkedAt)}</Fact>
              <Fact label="Verified">Signed challenge, confirmed by the player</Fact>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No wallet linked yet. The website asks the winner to link one; the payout waits, and only ever goes to that verified wallet.
            </p>
          )}
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Identity check
          </h3>
          {p.identity.details ? (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Fact label="Full name">{p.identity.details.fullName}</Fact>
              <Fact label="Date of birth">{formatDate(`${p.identity.details.dateOfBirth}T12:00:00.000Z`)}</Fact>
              <Fact label="ID">{ID_TYPE[p.identity.details.idType]}</Fact>
              <Fact label="ID number">
                <span className="font-mono">•••• {p.identity.details.idLast4}</span>
              </Fact>
              {p.identity.submittedAt && <Fact label="Sent">{formatDateTime(p.identity.submittedAt)}</Fact>}
              {p.identity.reviewedAt && (
                <Fact label={p.identity.state === "rejected" ? "Rejected" : "Verified"}>
                  {p.identity.reviewedBy}, {formatDateTime(p.identity.reviewedAt)}
                </Fact>
              )}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {p.identityStatus === "notNeeded" ? "Not needed: the prize is under the threshold set on Treasury." : "The winner hasn't sent it yet. The website asks them to."}
            </p>
          )}
          {p.identity.state === "rejected" && p.identity.note && (
            <p className="mt-3 rounded-lg bg-flare-soft px-3 py-2 text-sm text-flare">&ldquo;{p.identity.note}&rdquo;</p>
          )}
          {p.identityStatus === "toReview" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={pending} onClick={() => run(() => verifyIdentityAction(p.id), `${who}'s identity check is verified`)}>
                Verify
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
                Reject
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Admins see this; nothing personal goes on chain.</p>
        </section>

        <section>
          <h3 className="text-sm font-medium">Record</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Fact label="Results confirmed">{formatDateTime(p.createdAt)}</Fact>
            {p.hold && (
              <Fact label="Held">
                {p.hold.by}, {formatDateTime(p.hold.at)}
              </Fact>
            )}
            {p.approvedAt && (
              <Fact label="Approved">
                {p.approvedBy}, {formatDateTime(p.approvedAt)}
              </Fact>
            )}
            {p.sentAt && <Fact label="Sent">{formatDateTime(p.sentAt)}</Fact>}
            {p.manual && (
              <Fact label="Paid by hand">
                {p.manual.by}, from <span className="font-mono">{p.manual.from}</span>
              </Fact>
            )}
          </dl>
          {p.manual?.note && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">&ldquo;{p.manual.note}&rdquo;</p>}
          {p.hold && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">&ldquo;{p.hold.reason}&rdquo;</p>}
          {p.txId && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Transaction, public on Hedera</p>
              <TxLink network={network} txId={p.txId} />
            </div>
          )}
          {p.status === "failed" && (
            <p className="mt-3 rounded-lg bg-flare-soft px-3 py-2 text-sm text-flare">
              {p.failure ?? "The network refused it."}{" "}
              <Link href="/hedera/jobs" className="font-medium underline">
                Retry it from Hedera jobs
              </Link>
              , or pay it by hand below.
            </p>
          )}
        </section>
      </div>

      {(p.status === "awaitingApproval" || p.status === "held" || canPayByHand) && (
        <SheetFooter className="border-t p-6">
          {p.status === "awaitingApproval" && (p.blocker || short) && (
            <p className="text-sm text-muted-foreground">{p.blocker ?? `The treasury has ${formatHbar(free)} free: not enough. Top it up first.`}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {p.status === "awaitingApproval" && (
              <>
                <Button disabled={pending || !!p.blocker || short} onClick={() => setApproving(true)}>
                  {pending && <Loader2 className="animate-spin" />}
                  Approve and send
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => setHolding(true)}>
                  Hold
                </Button>
              </>
            )}
            {p.status === "held" && (
              <Button variant="outline" disabled={pending} onClick={() => run(() => releasePayoutAction(p.id), `${who}'s payout is waiting for approval again`)}>
                Release the hold
              </Button>
            )}
            {canPayByHand && (
              <Button variant={p.status === "failed" ? "default" : "ghost"} disabled={pending} onClick={() => setPayingByHand(true)}>
                <HandCoins />
                Paid by hand
              </Button>
            )}
          </div>
        </SheetFooter>
      )}

      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title={`Send ${formatHbar(p.hbar)} to ${who}?`}
        description={
          <>
            From the treasury to {p.wallet?.accountId}, {p.player.name}&apos;s verified wallet, for {p.tournament.name}, {ordinal(p.place)} place. HBAR sent on
            Hedera can&apos;t be pulled back, and the transfer is public.
          </>
        }
        confirmLabel="Approve and send"
        onConfirm={() => run(() => approvePayoutAction(p.id), `Sending ${formatHbar(p.hbar)} to ${who}`)}
      />
      <ReasonDialog
        open={holding}
        onOpenChange={setHolding}
        title={`Hold ${who}'s payout?`}
        description="It stays unpaid until someone releases it. The reason goes on the record."
        label="Why"
        placeholder="The opponent reported a disconnect in the final"
        confirmLabel="Hold payout"
        onSubmit={async (reason) => {
          const res = await holdPayoutAction(p.id, reason);
          if ("error" in res) return res.error;
          toast.success(`${who}'s payout is on hold`);
        }}
      />
      {canPayByHand && <ManualPayoutDialog payout={p} open={payingByHand} onOpenChange={setPayingByHand} />}
      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Reject ${who}'s identity check?`}
        description="The payout keeps waiting. The winner gets an email and a notification on the website asking them to send it again, with your note."
        label="What should they fix?"
        placeholder="The name on the ID doesn't match the account"
        confirmLabel="Reject"
        destructive
        onSubmit={async (note) => {
          const res = await rejectIdentityAction(p.id, note);
          if ("error" in res) return res.error;
          toast.success(`${who} is asked to send the identity check again`);
        }}
      />
    </>
  );
}

/* ---- The table ---------------------------------------------------------- */

export function PayoutsTable({ rows, network, free }: { rows: PayoutRow[]; network: HederaNetwork; free: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const columns: Column<PayoutRow>[] = [
    {
      id: "player",
      header: "Winner",
      cell: (r) => (
        <span>
          <span className="block font-medium">{r.player.name}</span>
          <span className="block text-xs text-muted-foreground">@{r.player.handle}</span>
        </span>
      ),
      sortValue: (r) => r.player.name,
      csv: (r) => `${r.player.name} (@${r.player.handle})`,
    },
    {
      id: "prize",
      header: "Prize",
      cell: (r) => (
        <span>
          <span className="block">{r.tournament.name}</span>
          <span className="block text-xs text-muted-foreground">{ordinal(r.place)} place</span>
        </span>
      ),
      sortValue: (r) => `${r.tournament.name} ${String(r.place).padStart(3, "0")}`,
      csv: (r) => `${r.tournament.name}, ${ordinal(r.place)} place`,
    },
    {
      id: "hbar",
      header: "Amount",
      cell: (r) => <span className="font-medium tabular">{formatHbar(r.hbar)}</span>,
      sortValue: (r) => r.hbar,
      csv: (r) => r.hbar,
      pdf: (r) => formatHbar(r.hbar),
      className: "text-right",
      headClassName: "text-right",
    },
    {
      id: "identity",
      header: "Identity check",
      cell: (r) => <StatusBadge {...IDENTITY_STATUS[r.identityStatus]} />,
      sortValue: (r) => r.identityStatus,
      csv: (r) => IDENTITY_STATUS[r.identityStatus].label,
    },
    {
      id: "wallet",
      header: "Wallet",
      cell: (r) => (r.wallet ? <span className="font-mono text-xs">{r.wallet.accountId}</span> : <span className="text-muted-foreground">Not linked</span>),
      csv: (r) => r.wallet?.accountId ?? "",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge {...PAYOUT_STATUS[r.status]} />
          {r.manual && <span className="text-xs text-muted-foreground">Paid by hand</span>}
        </span>
      ),
      sortValue: (r) => r.status,
      csv: (r) => `${PAYOUT_STATUS[r.status].label}${r.manual ? " (by hand)" : ""}`,
    },
    // The tax record (the doc: every payout needs approval and a record): who approved it, and the transfer.
    { id: "approvedBy", header: "Approved by", cell: () => null, csv: (r) => r.approvedBy ?? "", exportOnly: true },
    { id: "approvedAt", header: "Approved at", cell: () => null, csv: (r) => r.approvedAt ?? "", exportOnly: true },
    { id: "tx", header: "Transaction", cell: () => null, csv: (r) => r.txId ?? "", exportOnly: true },
    { id: "manualFrom", header: "Paid by hand from", cell: () => null, csv: (r) => r.manual?.from ?? "", exportOnly: true },
    {
      id: "updated",
      header: "Updated",
      cell: (r) => <span className="text-muted-foreground">{formatDate(r.updatedAt)}</span>,
      sortValue: (r) => r.updatedAt,
      csv: (r) => r.updatedAt,
    },
  ];

  // One tournament's prizes at a time (the team, 2026-11-23); newest tournament first.
  const tournaments = [
    ...new Map([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => [r.tournament.id, r.tournament.name] as const)).entries(),
  ];

  const filters: Filter<PayoutRow>[] = [
    {
      id: "tournament",
      label: "Tournament",
      options: tournaments.map(([value, label]) => ({ value, label })),
      predicate: (r, v) => r.tournament.id === v,
    },
    {
      id: "status",
      label: "Status",
      options: Object.entries(PAYOUT_STATUS).map(([value, s]) => ({ value, label: s.label })),
      predicate: (r, v) => r.status === v,
    },
    {
      id: "identity",
      label: "Identity check",
      options: Object.entries(IDENTITY_STATUS).map(([value, s]) => ({ value, label: s.label })),
      predicate: (r, v) => r.identityStatus === v,
    },
    {
      id: "ready",
      label: "Ready",
      options: [{ value: "ready", label: "Ready to approve" }],
      predicate: (r) => r.status === "awaitingApproval" && !r.blocker,
    },
    {
      id: "manual",
      label: "Paid by hand",
      options: [{ value: "manual", label: "Paid by hand" }],
      predicate: (r) => !!r.manual,
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        searchText={(r) => `${r.player.name} ${r.player.handle} ${r.tournament.name} ${r.wallet?.accountId ?? ""}`}
        searchPlaceholder="Search by winner, tournament or wallet…"
        filters={filters}
        exportName="hbar-payouts"
        exportTitle="HBAR prize payouts"
        empty={{ icon: HandCoins, title: "No HBAR prizes yet", description: "Payouts appear here when a tournament that pays in HBAR confirms its results." }}
      />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">{open && <PayoutDetail key={open.id} p={open} network={network} free={free} />}</SheetContent>
      </Sheet>
    </>
  );
}
