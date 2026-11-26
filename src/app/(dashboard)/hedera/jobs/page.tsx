import { requireHedera } from "@/lib/hedera/mode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getJobs, getTreasury } from "@/lib/api/hedera";
import { formatCount } from "@/lib/format";
import { resolvedWithin } from "@/lib/hedera/payouts";
import { RefreshWhile } from "../refresh-while";
import { JobsTable } from "./jobs-table";

export const metadata: Metadata = { title: "Hedera jobs" };

/**
 * What the Hedera service couldn't finish on its own: mints that failed after
 * their retries, payments the gateway never confirmed or that came in short
 * or late, and payouts the network refused. A retry carries the job's
 * idempotency key, so nothing is minted or paid twice; a paid order that
 * can't mint is refunded in HBAR (the doc's refund path).
 */
export default async function HederaJobsPage() {
  requireHedera();
  const [jobs, { treasury }] = await Promise.all([getJobs(), getTreasury()]);
  const order = { working: 0, open: 1, resolved: 2 } as const;
  const rows = [...jobs].sort((a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt));
  const open = jobs.filter((j) => j.status === "open");
  const count = (kind: string) => open.filter((j) => j.kind === kind).length;

  return (
    <>
      <PageHeader
        title="Hedera jobs"
        description="Mints, payments and payouts that need a person. Retrying is safe: each job keeps its idempotency key, so nothing is minted or paid twice."
      />
      <RefreshWhile active={jobs.some((j) => j.status === "working")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Failed mints" value={formatCount(count("mint"))} tone={count("mint") ? "danger" : "default"} footer="Claims and purchases that didn't mint" />
        <StatCard label="Stuck payments" value={formatCount(count("payment"))} tone={count("payment") ? "warning" : "default"} footer="Unconfirmed, underpaid or late" />
        <StatCard label="Failed payouts" value={formatCount(count("payout"))} tone={count("payout") ? "danger" : "default"} footer="Prizes the network refused" />
        <StatCard
          label="Resolved this week"
          value={formatCount(resolvedWithin(jobs, 7))}
          footer="Retried, confirmed or refunded"
        />
      </div>

      <JobsTable rows={rows} network={treasury.network} />
    </>
  );
}
