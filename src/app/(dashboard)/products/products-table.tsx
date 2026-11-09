"use client";

import { MoreHorizontal, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Thumb } from "@/components/shared/thumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCount, formatNaira } from "@/lib/format";
import { COMIC_FORMAT, PRODUCT_STATUS, PRODUCT_TYPE, STOCK_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/types";
import { setProductStatusAction } from "./actions";

function RowMenu({ product }: { product: ProductRow }) {
  const [pending, start] = useTransition();
  const archived = product.status === "archived";

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${product.name}`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={`/products/${product.id}`} />}>Edit product</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                const res = await setProductStatusAction(product.id, archived ? "active" : "archived");
                if ("error" in res) return void toast.error(res.error);
                toast.success(archived ? `${product.name} is back in the store` : `${product.name} hidden from the store`);
              })
            }
          >
            {archived ? "Restore to store" : "Hide from store"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** A comic's formats and prices, one per line; merch's price, or its range when a variant is priced differently. */
function Prices({ p }: { p: ProductRow }) {
  if (p.type === "apparel") return <span className="tabular whitespace-nowrap">{p.priceLabel}</span>;
  if (!p.formats.length) return <span className="text-muted-foreground">Not on sale</span>;
  return (
    <span className="block text-sm">
      {p.formats.map((f) => (
        <span key={f.format} className="block whitespace-nowrap">
          <span className="text-muted-foreground">{COMIC_FORMAT[f.format]}</span>{" "}
          <span className="tabular">{f.free ? "Free" : formatNaira(f.price)}</span>
        </span>
      ))}
    </span>
  );
}

const columns: Column<ProductRow>[] = [
  {
    id: "product",
    header: "Product",
    cell: (p) => (
      <Link href={`/products/${p.id}`} className="flex items-center gap-3">
        <span className={cn("relative size-12 shrink-0 overflow-hidden rounded-lg", p.type === "comics" ? "bg-entry" : "bg-linen")}>
          {p.image && <Thumb src={p.image} alt="" fill sizes="48px" className={p.type === "comics" ? "object-cover object-top" : "object-contain p-1"} />}
        </span>
        <span className="flex items-center gap-2 font-medium">
          {p.name}
          {p.exclusive && <span className="rounded bg-primary px-1.5 py-0.5 text-[0.65rem] tracking-wider text-primary-foreground uppercase">Exclusive</span>}
        </span>
      </Link>
    ),
    sortValue: (p) => p.name,
    csv: (p) => p.name,
  },
  {
    id: "type",
    header: "Type",
    cell: (p) => <span className="text-muted-foreground">{PRODUCT_TYPE[p.type]}</span>,
    sortValue: (p) => p.type,
    csv: (p) => PRODUCT_TYPE[p.type],
  },
  {
    id: "price",
    header: "Price",
    cell: (p) => <Prices p={p} />,
    sortValue: (p) => p.priceFrom ?? Infinity,
    csv: (p) => (p.type === "apparel" ? p.priceLabel : p.formats.map((f) => `${COMIC_FORMAT[f.format]} ${f.price}`).join("; ")),
    pdf: (p) => p.priceLabel,
  },
  {
    id: "stock",
    header: "In stock",
    cell: (p) => (p.stock !== null ? <span className="tabular">{formatCount(p.stock)}</span> : <span className="text-muted-foreground">—</span>),
    sortValue: (p) => p.stock ?? -1,
    csv: (p) => p.stock ?? "",
  },
  {
    id: "stockStatus",
    header: "Stock status",
    // A comic sold only online has nothing on a shelf to run out of.
    cell: (p) => (p.stockStatus ? <StatusBadge {...STOCK_STATUS[p.stockStatus]} /> : <StatusBadge label="Digital only" tone="info" />),
    csv: (p) => (p.stockStatus ? STOCK_STATUS[p.stockStatus].label : "Digital only"),
  },
  {
    id: "sold",
    header: "Sold",
    cell: (p) => <span className="tabular">{formatCount(p.sold)}</span>,
    sortValue: (p) => p.sold,
    csv: (p) => p.sold,
  },
  {
    id: "status",
    header: "Visibility",
    cell: (p) => <StatusBadge {...PRODUCT_STATUS[p.status]} />,
    csv: (p) => PRODUCT_STATUS[p.status].label,
  },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    cell: (p) => <RowMenu product={p} />,
    className: "w-12",
  },
];

const filters: Filter<ProductRow>[] = [
  {
    id: "type",
    label: "Type",
    options: Object.entries(PRODUCT_TYPE).map(([value, label]) => ({ value, label })),
    predicate: (p, v) => p.type === v,
  },
  {
    id: "stock",
    label: "Stock status",
    options: [
      ...Object.entries(STOCK_STATUS).map(([value, s]) => ({ value, label: s.label })),
      { value: "digital", label: "Digital only" },
    ],
    predicate: (p, v) => (p.stockStatus ?? "digital") === v,
  },
  {
    id: "status",
    label: "Visibility",
    options: Object.entries(PRODUCT_STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (p, v) => p.status === v,
  },
];

export function ProductsTable({ products }: { products: ProductRow[] }) {
  return (
    <DataTable
      rows={products}
      columns={columns}
      getRowId={(p) => p.id}
      rowHref={(p) => `/products/${p.id}`}
      searchText={(p) => `${p.name} ${p.description}`}
      searchPlaceholder="Search products…"
      filters={filters}
      exportName="products"
      exportTitle="Products"
      empty={{
        icon: ShoppingBag,
        title: "No products yet",
        description: "Products you add will appear here.",
        action: (
          <Button size="xl" render={<Link href="/products/new" />}>
            <Plus />
            Add product
          </Button>
        ),
      }}
    />
  );
}

