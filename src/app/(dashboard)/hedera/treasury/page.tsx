import { requireHedera } from "@/lib/hedera/mode";
import { ExternalLink, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getTreasury } from "@/lib/api/hedera";
import { formatHbar } from "@/lib/format";
import { hashscanUrl } from "@/lib/hedera/links";
import { MovementsTable } from "./movements-table";
import { TreasuryForm } from "./treasury-form";

export const metadata: Metadata = { title: "Treasury" };

/** "November 2026" for "2026-11". */
const monthName = (key: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T00:00:00Z`));

/**
 * Goondu's HBAR treasury: the account store payments arrive in and prizes and
 * refunds leave from. Its keys are in KMS, held by the Hedera service; this
 * admin reads the balance and sets the alert line, and never signs anything.
 */
export default async function TreasuryPage() {
  requireHedera();
  const { treasury, movements, months, thisMonth } = await getTreasury();
  const low = treasury.balance < treasury.alertBelow;
  const out = treasury.committed.sending + treasury.committed.awaitingApproval;
  const after = treasury.balance - out;

  return (
    <>
      <PageHeader
        title="Treasury"
        description="The HBAR account the store is paid into and prizes are paid from. The account, its balance and every movement are public on Hedera."
      />

      {low && (
        <p role="alert" className="flex items-start gap-2.5 rounded-lg bg-flare-soft px-4 py-3 text-sm text-flare">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Below the alert line.</span> {formatHbar(treasury.balance)} left against {formatHbar(treasury.alertBelow)}. Top it up from
            Goondu&apos;s funding wallet before approving more payouts.
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Balance" value={formatHbar(treasury.balance)} tone={low ? "danger" : "default"} footer={`Warns below ${formatHbar(treasury.alertBelow)}`} />
        <StatCard
          label="Spent this month"
          value={formatHbar(thisMonth?.spent ?? 0)}
          footer={`Prizes ${formatHbar(thisMonth?.payouts ?? 0)} · refunds ${formatHbar(thisMonth?.refunds ?? 0)} · fees ${formatHbar(thisMonth?.fees ?? 0)}`}
        />
        <StatCard label="Paid in this month" value={formatHbar(thisMonth?.received ?? 0)} footer="Game store and HBAR checkouts" />
        <StatCard
          label="Going out"
          value={formatHbar(out)}
          tone={after < treasury.alertBelow ? "warning" : "default"}
          footer={`${formatHbar(treasury.committed.sending)} sending · ${formatHbar(treasury.committed.awaitingApproval)} awaiting approval · ${formatHbar(after)} after`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Panel title="By month" description="HBAR out and in, Lagos time. Top-ups count as neither." bodyClassName="p-0 pb-2">
            <div className="overflow-x-auto px-5">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2.5 pr-3 text-left font-medium">Month</th>
                    <th className="px-3 py-2.5 text-right font-medium">Prizes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Refunds</th>
                    <th className="px-3 py-2.5 text-right font-medium">Fees</th>
                    <th className="px-3 py-2.5 text-right font-medium">Spent</th>
                    <th className="py-2.5 pl-3 text-right font-medium">Paid in</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {months.map((m) => (
                    <tr key={m.month}>
                      <td className="py-2.5 pr-3 font-medium">{monthName(m.month)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{formatHbar(m.payouts)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{formatHbar(m.refunds)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{formatHbar(m.fees)}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular">{formatHbar(m.spent)}</td>
                      <td className="py-2.5 pl-3 text-right text-moss tabular">{formatHbar(m.received)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Account" action={<StatusBadge label={treasury.network === "mainnet" ? "Mainnet" : "Testnet"} tone={treasury.network === "mainnet" ? "success" : "info"} />}>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Treasury account</dt>
                <dd className="mt-0.5">
                  <a href={hashscanUrl(treasury.network, "account", treasury.accountId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:underline">
                    {treasury.accountId}
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Keys</dt>
                <dd className="mt-0.5">In KMS, held by the Hedera service. Nobody signs from this admin.</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Topping up</dt>
                <dd className="mt-0.5">From Goondu&apos;s funding wallet, by whoever holds it. It shows here as a top-up.</dd>
              </div>
            </dl>
          </Panel>
          <TreasuryForm settings={{ alertBelow: treasury.alertBelow, identityThreshold: treasury.identityThreshold, hbarDiscountPct: treasury.hbarDiscountPct }} />
        </div>
      </div>

      <SectionHeader title="Movements" />
      <MovementsTable rows={movements} network={treasury.network} />
    </>
  );
}
