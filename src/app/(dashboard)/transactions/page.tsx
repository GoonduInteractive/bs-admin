import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getTournaments } from "@/lib/api/competition";
import { getOrders, getTransactions } from "@/lib/api/orders";
import { formatCount, formatNaira, formatNairaCompact } from "@/lib/format";
import { TransactionsTable, type RelatedLinks } from "./transactions-table";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const [transactions, orders, tournaments] = await Promise.all([getTransactions(), getOrders(), getTournaments()]);

  const settled = transactions.filter((t) => t.status === "successful");
  const moneyIn = settled.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const moneyOut = settled.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const fees = settled.reduce((s, t) => s + t.fee, 0);
  const pending = transactions.filter((t) => t.status === "pending");
  const failed = transactions.filter((t) => t.status === "failed").length;

  const related: RelatedLinks = {
    ...Object.fromEntries(orders.map((o) => [o.id, { label: `Order #${o.reference}`, href: `/orders/${o.id}` }])),
    ...Object.fromEntries(tournaments.map((t) => [t.id, { label: t.name, href: `/tournaments/${t.slug}` }])),
  };

  return (
    <>
      <PageHeader title="Transactions" description="Every naira in and out: store sales, store refunds and prize payouts." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Money in" value={formatNairaCompact(moneyIn)} tone="success" footer={`${formatNaira(fees)} in processor fees`} />
        <StatCard label="Money out" value={formatNairaCompact(moneyOut)} tone="danger" footer="Refunds and prize payouts" />
        <StatCard
          label="Pending"
          value={formatCount(pending.length)}
          tone="warning"
          footer={`${formatNaira(pending.reduce((s, t) => s + t.amount, 0))} awaiting Paystack`}
        />
        <StatCard label="Failed" value={formatCount(failed)} footer="Declined or abandoned payments" />
      </div>

      <SectionHeader title="All transactions" />
      <TransactionsTable transactions={transactions} related={related} />
    </>
  );
}
