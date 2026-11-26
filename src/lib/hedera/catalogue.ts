import type { AssetFamily, FiatPrice, HbarRate, StoreItem, StoreItemState } from "@/types/hedera";

/**
 * The game store catalogue's rules, pure so the table, the form and the
 * actions read them the same way.
 */

/** Where an item stands on the store at `now`. A sold-out item stays sold out whatever its window says. */
export function storeItemState(item: Pick<StoreItem, "published" | "publishedAt" | "saleStartsAt" | "saleEndsAt" | "supply">, now = Date.now()): StoreItemState {
  if (!item.published) return item.publishedAt ? "unpublished" : "draft";
  if (item.supply && item.supply.remaining <= 0) return "soldOut";
  if (item.saleEndsAt && Date.parse(item.saleEndsAt) <= now) return "ended";
  if (item.saleStartsAt && Date.parse(item.saleStartsAt) > now) return "scheduled";
  return "live";
}

/** What a store price comes to in HBAR at the gateway's rate, to two places. The checkout quotes it again, for 10 minutes. */
export function estimateHbar(price: FiatPrice, rate: Pick<HbarRate, "NGN" | "USD">): number {
  return Math.round((price.amount / rate[price.currency]) * 100) / 100;
}

/** ₦4,500 or $25. */
export function formatPrice(price: FiatPrice): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: price.currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(
    price.amount,
  );
}

/**
 * The asset ID a new item gets: `bs-<family>-<name>`, the website's own
 * pattern ("bs-skin-soma-ember"). It never changes afterwards, since other
 * Goondu games recognise the NFT by it.
 */
export function assetIdFor(family: AssetFamily, name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `bs-${family}-${slug}`;
}

/** "132 of 500 left", "Sold out", "Unlimited". */
export function supplyLabel(item: Pick<StoreItem, "supply">): string {
  if (!item.supply) return "Unlimited";
  if (item.supply.remaining <= 0) return "Sold out";
  return `${item.supply.remaining.toLocaleString("en-NG")} of ${item.supply.total.toLocaleString("en-NG")} left`;
}
