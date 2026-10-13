import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getOrders } from "@/lib/api/orders";
import { formatCount } from "@/lib/format";
import { OrdersTable } from "./orders-table";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { q } = await searchParams;
  const orders = await getOrders();
  const count = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <>
      <PageHeader title="Orders" description="Merch and print-comic orders from the Beyond Service store." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total orders" value={formatCount(orders.length)} />
        <StatCard label="Awaiting action" value={formatCount(count("pending") + count("processing"))} tone="warning" footer="Pending or processing" />
        <StatCard label="Delivered" value={formatCount(count("delivered"))} tone="success" footer={`${count("inTransit")} more in transit`} />
        <StatCard label="Cancelled" value={formatCount(count("cancelled"))} tone="danger" />
      </div>

      <SectionHeader title="All orders" />
      <OrdersTable orders={orders} initialQuery={typeof q === "string" ? q : undefined} />
    </>
  );
}
