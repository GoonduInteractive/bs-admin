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
import { formatsOnSale, priceLabel, unitsSold } from "@/lib/comics";
import { COMIC_FORMAT, PRODUCT_STATUS, PRODUCT_TYPE, STOCK_STATUS } from "@/lib/labels";
import { priceRange } from "@/lib/pricing";
import { stockStatus, totalStock } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { setProductStatusAction } from "./actions";

function RowMenu({ product }: { product: Product }) {
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
function Prices({ p }: { p: Product }) {
  if (p.type === "apparel") return <span className="tabular whitespace-nowrap">{priceLabel(p)}</span>;
  const on = formatsOnSale(p);
  if (!on.length) return <span className="text-muted-foreground">Not on sale</span>;
  return (
    <span className="block text-sm">
      {on.map((f) => (
        <span key={f} className="block whitespace-nowrap">
          <span className="text-muted-foreground">{COMIC_FORMAT[f]}</span>{" "}
          <span className="tabular">{f === "online" && p.formats.online.free ? "Free" : formatNaira(p.formats[f].price)}</span>
        </span>
      ))}
    </span>
  );
}

const columns: Column<Product>[] = [
  {
    id: "product",
    header: "Product",
    cell: (p) => (
      <Link href={`/products/${p.id}`} className="flex items-center gap-3">
        <span className={cn("relative size-12 shrink-0 overflow-hidden rounded-lg", p.type === "comics" ? "bg-entry" : "bg-linen")}>
          <Thumb src={p.image} alt="" fill sizes="48px" className={p.type === "comics" ? "object-cover object-top" : "object-contain p-1"} />
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
    sortValue: (p) => (p.type === "apparel" ? priceRange(p).lo : Math.min(...formatsOnSale(p).map((f) => p.formats[f].price), Infinity)),
    csv: (p) => (p.type === "apparel" ? priceLabel(p) : formatsOnSale(p).map((f) => `${COMIC_FORMAT[f]} ${p.formats[f].price}`).join("; ")),
    pdf: (p) => priceLabel(p),
  },
  {
    id: "stock",
    header: "In stock",
    cell: (p) =>
      stockStatus(p) ? <span className="tabular">{formatCount(totalStock(p))}</span> : <span className="text-muted-foreground">—</span>,
    sortValue: (p) => (stockStatus(p) ? totalStock(p) : -1),
    csv: (p) => (stockStatus(p) ? totalStock(p) : ""),
  },
  {
    id: "stockStatus",
    header: "Stock status",
    cell: (p) => {
      const s = stockStatus(p);
      // A comic sold only online has nothing on a shelf to run out of.
      return s ? <StatusBadge {...STOCK_STATUS[s]} /> : <StatusBadge label="Digital only" tone="info" />;
    },
    csv: (p) => {
      const s = stockStatus(p);
      return s ? STOCK_STATUS[s].label : "Digital only";
    },
  },
  {
    id: "sold",
    header: "Sold",
    cell: (p) => <span className="tabular">{formatCount(unitsSold(p))}</span>,
    sortValue: (p) => unitsSold(p),
    csv: (p) => unitsSold(p),
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

const filters: Filter<Product>[] = [
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
    predicate: (p, v) => (stockStatus(p) ?? "digital") === v,
  },
  {
    id: "status",
    label: "Visibility",
    options: Object.entries(PRODUCT_STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (p, v) => p.status === v,
  },
];

export function ProductsTable({ products }: { products: Product[] }) {
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

