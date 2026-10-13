"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatNaira } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import type { Order } from "@/types";
import { OrderRowMenu } from "./order-status-menu";

const columns: Column<Order>[] = [
  {
    id: "reference",
    header: "Order ID",
    cell: (o) => (
      <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
        #{o.reference}
      </Link>
    ),
    sortValue: (o) => o.reference,
    csv: (o) => o.reference,
  },
  {
    id: "customer",
    header: "Customer",
    cell: (o) => (
      <div>
        <p>{o.customer.name}</p>
        {o.customer.handle && <p className="text-xs text-muted-foreground">@{o.customer.handle}</p>}
      </div>
    ),
    sortValue: (o) => o.customer.name,
    csv: (o) => o.customer.name,
  },
  {
    id: "items",
    header: "Items",
    cell: (o) => (
      <div className="max-w-56">
        <p className="truncate">{o.lines[0].name}</p>
        <p className="text-xs text-muted-foreground">
          {[o.lines[0].colour, o.lines[0].size].filter(Boolean).join(" · ")}
          {o.lines.length > 1 && ` + ${o.lines.length - 1} more`}
        </p>
      </div>
    ),
    csv: (o) => o.lines.map((l) => `${l.quantity}x ${l.name}`).join("; "),
  },
  {
    id: "total",
    header: "Amount",
    cell: (o) => <span className="tabular">{formatNaira(o.total)}</span>,
    sortValue: (o) => o.total,
    csv: (o) => o.total,
    pdf: (o) => formatNaira(o.total),
  },
  {
    id: "payment",
    header: "Payment",
    cell: (o) => <span className="text-muted-foreground">{PAYMENT_METHOD[o.paymentMethod]}</span>,
    csv: (o) => PAYMENT_METHOD[o.paymentMethod],
  },
  {
    id: "status",
    header: "Status",
    cell: (o) => <StatusBadge {...ORDER_STATUS[o.status]} />,
    sortValue: (o) => o.status,
    csv: (o) => ORDER_STATUS[o.status].label,
  },
  {
    id: "date",
    header: "Date",
    cell: (o) => <span className="whitespace-nowrap">{formatDate(o.placedAt)}</span>,
    sortValue: (o) => o.placedAt,
    csv: (o) => o.placedAt,
  },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    cell: (o) => <OrderRowMenu id={o.id} reference={o.reference} status={o.status} />,
    className: "w-12 text-right",
  },
];

const filters: Filter<Order>[] = [
  {
    id: "status",
    label: "Status",
    options: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (o, v) => o.status === v,
  },
  {
    id: "item",
    label: "Item",
    options: [
      { value: "prd_hoodie", label: "Goondu Hoodie" },
      { value: "prd_tee", label: "Goondu Tee" },
      { value: "prd_tote", label: "Goondu Tote" },
      { value: "prd_beanie", label: "Goondu Beanie" },
      { value: "prd_trial", label: "Trial of the Gods Vol. 1" },
    ],
    predicate: (o, v) => o.lines.some((l) => l.refId === v),
  },
  {
    id: "payment",
    label: "Payment",
    options: Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label })),
    predicate: (o, v) => o.paymentMethod === v,
  },
];

export function OrdersTable({ orders, initialQuery }: { orders: Order[]; initialQuery?: string }) {
  return (
    <DataTable
      rows={orders}
      columns={columns}
      getRowId={(o) => o.id}
      rowHref={(o) => `/orders/${o.id}`}
      searchText={(o) => `${o.reference} ${o.customer.name} ${o.customer.email} ${o.customer.handle ?? ""}`}
      searchPlaceholder="Search by order, name or email…"
      initialQuery={initialQuery}
      filters={filters}
      exportName="orders"
      exportTitle="Orders"
      empty={{ icon: ShoppingBag, title: "No orders yet", description: "Orders from the merch store will appear here." }}
    />
  );
}
