import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getOrderStats, getOrders } from "@/lib/api/orders";
import { formatCount } from "@/lib/format";
import { OrdersTable } from "./orders-table";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { q } = await searchParams;
  const [orders, stats] = await Promise.all([getOrders(), getOrderStats()]);

  return (
    <>
      <PageHeader title="Orders" description="Merch and print-comic orders from the Beyond Service store." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total orders" value={formatCount(stats.total)} />
        <StatCard label="Awaiting action" value={formatCount(stats.awaitingAction)} tone="warning" footer="Pending or processing" />
        <StatCard label="Delivered" value={formatCount(stats.delivered)} tone="success" footer={`${formatCount(stats.inTransit)} more in transit`} />
        <StatCard label="Cancelled" value={formatCount(stats.cancelled)} tone="danger" />
      </div>

      <SectionHeader title="All orders" />
      <OrdersTable orders={orders} initialQuery={typeof q === "string" ? q : undefined} />
    </>
  );
}
