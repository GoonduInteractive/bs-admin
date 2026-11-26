"use client";

import { Gem, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCount, formatDate, formatHbar } from "@/lib/format";
import { estimateHbar, formatPrice, supplyLabel } from "@/lib/hedera/catalogue";
import { hashscanUrl } from "@/lib/hedera/links";
import { ASSET_COLLECTION, ASSET_FAMILY, ASSET_RARITY, STORE_ITEM_STATE } from "@/lib/labels";
import { ASSET_RARITIES, type HbarRate, type HederaNetwork, type StoreItem, type StoreItemState } from "@/types/hedera";
import { setStoreItemPublishedAction } from "../actions";
import { ItemArt } from "./item-art";

export type StoreRow = StoreItem & { state: StoreItemState };

/** "Always", "Until Dec 5, 2026", "Dec 1, 2026 – Dec 9, 2026". */
function windowLabel(i: StoreItem): string {
  if (i.saleStartsAt && i.saleEndsAt) return `${formatDate(i.saleStartsAt)} – ${formatDate(i.saleEndsAt)}`;
  if (i.saleStartsAt) return `From ${formatDate(i.saleStartsAt)}`;
  if (i.saleEndsAt) return `Until ${formatDate(i.saleEndsAt)}`;
  return "Always";
}

function RowMenu({ row, network }: { row: StoreRow; network: HederaNetwork }) {
  const [pending, start] = useTransition();
  const publish = !row.published;
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<Link href={`/hedera/store/${row.id}`} />}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                const res = await setStoreItemPublishedAction(row.id, publish);
                if ("error" in res) toast.error(res.error);
                else toast.success(publish ? `${row.name} is published` : `${row.name} is off the store. Players who have it keep it.`);
              })
            }
          >
            {publish ? "Publish" : "Unpublish"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href={hashscanUrl(network, "token", row.tokenId)} target="_blank" rel="noreferrer" />}>
            {ASSET_COLLECTION[row.family]} collection on HashScan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function StoreTable({ rows, rate, network, saved }: { rows: StoreRow[]; rate: HbarRate; network: HederaNetwork; saved?: string }) {
  // Back from the form: say it saved, once.
  useEffect(() => {
    const item = saved && rows.find((r) => r.id === saved);
    if (item) toast.success(`${item.name} saved`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const columns: Column<StoreRow>[] = [
    {
      id: "item",
      header: "Item",
      cell: (r) => (
        <span className="flex items-center gap-3">
          <ItemArt src={r.image} alt={r.imageAlt} />
          <span className="min-w-0">
            <span className="block font-medium">{r.name}</span>
            <span className="block font-mono text-xs text-muted-foreground">{r.id}</span>
          </span>
        </span>
      ),
      sortValue: (r) => r.name,
      csv: (r) => `${r.name} (${r.id})`,
    },
    // Family over rarity, so nine columns fit a 1440 screen with the sidebar open; the export keeps them apart.
    {
      id: "kind",
      header: "Kind",
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <span>{ASSET_FAMILY[r.family]}</span>
          <StatusBadge {...ASSET_RARITY[r.rarity]} />
        </span>
      ),
      sortValue: (r) => `${r.family} ${ASSET_RARITIES.indexOf(r.rarity)}`,
    },
    { id: "family", header: "Family", cell: () => null, csv: (r) => ASSET_FAMILY[r.family], exportOnly: true },
    { id: "rarity", header: "Rarity", cell: () => null, csv: (r) => ASSET_RARITY[r.rarity].label, exportOnly: true },
    {
      id: "price",
      header: "Price",
      cell: (r) =>
        r.price ? (
          <span>
            <span className="block font-medium tabular">{formatPrice(r.price)}</span>
            <span className="block text-xs text-muted-foreground tabular">≈ {formatHbar(estimateHbar(r.price, rate))}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Free on wallet link</span>
        ),
      sortValue: (r) => (r.price ? estimateHbar(r.price, rate) : 0),
      csv: (r) => (r.price ? formatPrice(r.price) : "Free"),
    },
    { id: "supply", header: "Supply", cell: (r) => <span className="tabular">{supplyLabel(r)}</span>, csv: (r) => supplyLabel(r) },
    {
      id: "window",
      header: "Sale window",
      // Both ends: one per line.
      cell: (r) =>
        r.saleStartsAt && r.saleEndsAt ? (
          <span className="text-muted-foreground">
            <span className="block whitespace-nowrap">{formatDate(r.saleStartsAt)} –</span>
            <span className="block whitespace-nowrap">{formatDate(r.saleEndsAt)}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap text-muted-foreground">{windowLabel(r)}</span>
        ),
      csv: (r) => windowLabel(r),
    },
    {
      id: "sold",
      header: "Sold",
      cell: (r) => (
        <span className="tabular">
          {formatCount(r.sold)} <span className="text-muted-foreground">{r.access === "free" ? "claimed" : "sold"}</span>
        </span>
      ),
      sortValue: (r) => r.sold,
      csv: (r) => r.sold,
    },
    {
      id: "state",
      header: "Status",
      cell: (r) => <StatusBadge {...STORE_ITEM_STATE[r.state]} />,
      sortValue: (r) => r.state,
      csv: (r) => STORE_ITEM_STATE[r.state].label,
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (r) => <RowMenu row={r} network={network} />, className: "w-12" },
  ];

  const filters: Filter<StoreRow>[] = [
    {
      id: "state",
      label: "Status",
      options: Object.entries(STORE_ITEM_STATE).map(([value, s]) => ({ value, label: s.label })),
      predicate: (r, v) => r.state === v,
    },
    {
      id: "family",
      label: "Family",
      options: Object.entries(ASSET_FAMILY).map(([value, label]) => ({ value, label })),
      predicate: (r, v) => r.family === v,
    },
    {
      id: "access",
      label: "Access",
      options: [
        { value: "sale", label: "For sale" },
        { value: "free", label: "Free on wallet link" },
      ],
      predicate: (r, v) => r.access === v,
    },
  ];

  const add = (
    <Button render={<Link href="/hedera/store/new" />}>
      <Plus />
      Add item
    </Button>
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      rowHref={(r) => `/hedera/store/${r.id}`}
      searchText={(r) => `${r.name} ${r.id}`}
      searchPlaceholder="Search by name or asset ID…"
      filters={filters}
      toolbar={add}
      exportName="game-store"
      exportTitle="Game store catalogue"
      empty={{ icon: Gem, title: "No exclusives yet", description: "Add the first skin, weapon or character for the game store.", action: add }}
    />
  );
}
