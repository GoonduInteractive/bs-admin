import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { getProducts } from "@/lib/api/merch";
import { unitsSold } from "@/lib/comics";
import { formatCount, formatNairaCompact } from "@/lib/format";
import { variantPrice } from "@/lib/pricing";
import { stockStatus, totalStock } from "@/lib/stock";
import type { Product } from "@/types";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = { title: "Products" };

/** What the shelf is worth: each merch variant at its own price, or a comic's print copies. */
function shelfValue(p: Product) {
  if (p.type === "comics") return totalStock(p) * p.formats.physical.price;
  return p.stock.reduce((s, v) => s + v.quantity * variantPrice(p, v.colourId, v.size), 0);
}

/**
 * Every product in the store. A product is one of two types, Merch (`apparel`) or
 * Comics, as the backend defines them; the Type column and filter separate
 * them, and the type is the first thing the add-product form asks.
 */
export default async function ProductsPage() {
  const products = await getProducts();
  const live = products.filter((p) => p.status === "active");
  const count = (t: Product["type"]) => live.filter((p) => p.type === t).length;
  const restock = live.filter((p) => {
    const s = stockStatus(p);
    return s === "lowStock" || s === "outOfStock";
  });
  const sold = (t: Product["type"]) => products.filter((p) => p.type === t).reduce((s, p) => s + unitsSold(p), 0);
  const value = products.reduce((s, p) => s + shelfValue(p), 0);

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
        <StatCard label="Live products" value={formatCount(live.length)} footer={`${count("apparel")} merch · ${count("comics")} ${count("comics") === 1 ? "comic" : "comics"}`} />
        <StatCard
          label="Units sold"
          value={formatCount(sold("apparel") + sold("comics"))}
          footer={`${formatCount(sold("apparel"))} merch · ${formatCount(sold("comics"))} comics`}
        />
        <StatCard
          label="Needs restock"
          value={formatCount(restock.length)}
          tone={restock.length ? "warning" : "default"}
          footer={restock.map((p) => p.name).join(", ") || "Everything is stocked"}
        />
        <StatCard label="Stock value" value={formatNairaCompact(value)} footer="Merch and print copies on hand × price" />
      </div>

      <SectionHeader title="All products" />
      <ProductsTable products={products} />
    </>
  );
}
