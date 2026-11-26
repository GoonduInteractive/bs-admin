import { requireHedera } from "@/lib/hedera/mode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getHbarRate, getStoreItems, getStoreStats, getTreasury } from "@/lib/api/hedera";
import { formatCount, formatHbar } from "@/lib/format";
import { storeItemState } from "@/lib/hedera/catalogue";
import { StoreTable, type StoreRow } from "./store-table";

export const metadata: Metadata = { title: "Game store" };

/**
 * The game store's Hedera exclusives: skins, weapons and characters, sold for
 * HBAR on the website or free to every player who links a wallet. Prices are
 * set in naira or dollars; the website shows them in HBAR with a quote that
 * expires.
 */
export default async function GameStorePage({ searchParams }: PageProps<"/hedera/store">) {
  requireHedera();
  const { saved } = await searchParams;
  const [items, stats, rate, { treasury }] = await Promise.all([getStoreItems(), getStoreStats(), getHbarRate(), getTreasury()]);
  const rows: StoreRow[] = items.map((i) => ({ ...i, state: storeItemState(i) }));

  return (
    <>
      <PageHeader
        title="Game store"
        description="Hedera exclusives for the game store. They're cosmetic: none gives an advantage in a match. Ownership is public on Hedera."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On the store" value={formatCount(stats.live)} footer={`${formatCount(stats.scheduled)} scheduled · ${formatCount(stats.soldOut)} sold out`} />
        <StatCard label="Sold this month" value={formatCount(stats.salesThisMonth)} footer={`${formatHbar(stats.hbarThisMonth)} into the treasury`} />
        <StatCard
          label="Ending in 7 days"
          value={formatCount(stats.endingSoon)}
          tone={stats.endingSoon ? "warning" : "default"}
          footer="Limited-time sales about to close"
        />
        <StatCard label="Off the store" value={formatCount(stats.drafts)} footer="Drafts and unpublished items" />
      </div>

      <StoreTable rows={rows} rate={rate} network={treasury.network} saved={typeof saved === "string" ? saved : undefined} />
    </>
  );
}
