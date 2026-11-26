import { requireHedera } from "@/lib/hedera/mode";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getPayouts, getTreasury } from "@/lib/api/hedera";
import { formatCount, formatHbar } from "@/lib/format";
import { approvalBlocker, identityStatus } from "@/lib/hedera/payouts";
import { RefreshWhile } from "../refresh-while";
import { PayoutsTable, type PayoutRow } from "./payouts-table";

export const metadata: Metadata = { title: "Payouts" };

/** Lagos month of an instant, "2026-11". */
const month = (at: string) => new Date(Date.parse(at) + 3_600_000).toISOString().slice(0, 7);

/**
 * Tournament prizes paid in HBAR. Results come from the game backend; above
 * the threshold the winner completes a light identity check; then an admin
 * approves and the Hedera service sends the HBAR from the treasury to the
 * winner's verified wallet. Nothing is sent without an approval here.
 */
export default async function PayoutsPage() {
  requireHedera();
  const [payouts, { treasury }] = await Promise.all([getPayouts(), getTreasury()]);
  const threshold = treasury.identityThreshold;
  const rows: PayoutRow[] = payouts
    .map((p) => ({ ...p, identityStatus: identityStatus(p, threshold), blocker: approvalBlocker(p, threshold) }))
    // What needs an admin first: ready to approve, then identity checks to review, then the rest by date.
    .sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
  const ready = rows.filter((r) => r.status === "awaitingApproval" && !r.blocker);
  const toReview = rows.filter((r) => r.identityStatus === "toReview" && r.status !== "sent");
  const waitingPlayer = rows.filter((r) => r.status === "awaitingApproval" && (r.identityStatus === "waiting" || r.identityStatus === "rejected" || !r.wallet));
  const held = rows.filter((r) => r.status === "held");
  const thisMonth = month(new Date().toISOString());
  const sent = rows.filter((r) => r.status === "sent" && r.sentAt && month(r.sentAt) === thisMonth);
  const sum = (list: PayoutRow[]) => list.reduce((s, r) => s + r.hbar, 0);
  const free = treasury.balance - treasury.committed.sending;

  return (
    <>
      <PageHeader
        title="Payouts"
        description={
          <>
            HBAR tournament prizes. Each one needs an approval here and goes only to the winner&apos;s verified wallet. Prizes over{" "}
            {formatHbar(threshold)} need the winner&apos;s identity check first (
            <Link href="/hedera/treasury" className="font-medium text-signal hover:underline">
              change it on Treasury
            </Link>
            ).
          </>
        }
      />

      <RefreshWhile active={rows.some((r) => r.status === "sending")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ready to approve"
          value={formatCount(ready.length)}
          tone={ready.length ? "warning" : "default"}
          footer={`${formatHbar(sum(ready))} · the treasury has ${formatHbar(free)} free`}
        />
        <StatCard
          label="Identity checks to review"
          value={formatCount(toReview.length)}
          tone={toReview.length ? "warning" : "default"}
          footer={`${formatCount(waitingPlayer.length)} waiting for the winner`}
        />
        <StatCard label="On hold" value={formatCount(held.length)} footer={held.length ? formatHbar(sum(held)) : "Nothing held"} />
        <StatCard label="Sent this month" value={formatHbar(sum(sent))} footer={`${formatCount(sent.length)} ${sent.length === 1 ? "prize" : "prizes"}`} />
      </div>

      <PayoutsTable rows={rows} network={treasury.network} free={free} />
    </>
  );
}

function rank(r: PayoutRow): number {
  if (r.status === "awaitingApproval" && !r.blocker) return 0;
  if (r.identityStatus === "toReview" && r.status === "awaitingApproval") return 1;
  if (r.status === "failed") return 2;
  if (r.status === "awaitingApproval" || r.status === "held" || r.status === "sending") return 3;
  return 4;
}
