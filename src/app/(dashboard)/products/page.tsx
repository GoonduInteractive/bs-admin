import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { getProductRows, getProductStats } from "@/lib/api/merch";
import { formatCount, formatNairaCompact } from "@/lib/format";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = { title: "Products" };

/**
 * Every product in the store. A product is one of two types, Merch (`apparel`) or
 * Comics, as the backend defines them; the Type column and filter separate
 * them, and the type is the first thing the add-product form asks.
 */
export default async function ProductsPage() {
  const [products, stats] = await Promise.all([getProductRows(), getProductStats()]);
  const { live, sold, restock } = stats;

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in the Beyond Service store: Goondu merch, and the comics online and in print."
        actions={
          <Button size="xl" render={<Link href="/products/new" />}>
            <Plus />
            Add product
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live products" value={formatCount(live.total)} footer={`${live.merch} merch · ${live.comics} ${live.comics === 1 ? "comic" : "comics"}`} />
        <StatCard label="Units sold" value={formatCount(sold.total)} footer={`${formatCount(sold.merch)} merch · ${formatCount(sold.comics)} comics`} />
        <StatCard
          label="Needs restock"
          value={formatCount(restock.count)}
          tone={restock.count ? "warning" : "default"}
          footer={restock.titles.join(", ") || "Everything is stocked"}
        />
        <StatCard label="Stock value" value={formatNairaCompact(stats.stockValue)} footer="Merch and print copies on hand × price" />
      </div>

      <SectionHeader title="All products" />
      <ProductsTable products={products} />
    </>
  );
}
