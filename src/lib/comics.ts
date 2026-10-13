import type { Comic, ComicFormat, ComicProduct, ComicVolume, Product } from "@/types";
import { formatNaira } from "./format";
import { priceRange } from "./pricing";

/* ---- Volumes and chapters ---------------------------------------------- */

/** "Vol. 1 · Ch. 3" - where a chapter sits. */
export function chapterPlace(chapter: Pick<Comic, "chapter">, volume?: Pick<ComicVolume, "number">): string {
  return volume ? `Vol. ${volume.number} · Ch. ${chapter.chapter}` : `Ch. ${chapter.chapter}`;
}

/**
 * A chapter's name everywhere outside Comics - the store listing, orders:
 * "Trial of the Gods Ch. 1: Testing Waters".
 */
export function chapterName(chapter: Pick<Comic, "chapter" | "title">, volume?: Pick<ComicVolume, "title">): string {
  return volume ? `${volume.title} Ch. ${chapter.chapter}: ${chapter.title}` : `Ch. ${chapter.chapter}: ${chapter.title}`;
}

/** The number the next chapter added to a volume takes. */
export function nextChapterNumber(chapters: readonly Pick<Comic, "volumeId" | "chapter">[], volumeId: string): number {
  return Math.max(0, ...chapters.filter((c) => c.volumeId === volumeId).map((c) => c.chapter)) + 1;
}

/**
 * Whether a volume is complete: it has chapters and every one is published.
 * Only a complete volume can be sold in print as one book. `waiting` is the
 * first chapter that isn't out yet, to say why not.
 */
export function volumeCompleteness(volumeId: string, chapters: readonly Comic[]) {
  const own = chapters.filter((c) => c.volumeId === volumeId).sort((a, b) => a.chapter - b.chapter);
  const published = own.filter((c) => c.status === "published").length;
  return { total: own.length, published, complete: own.length > 0 && published === own.length, waiting: own.find((c) => c.status !== "published") };
}

/** A volume's cover: its own, or its first chapter's. */
export function volumeCover(volume: ComicVolume, chapters: readonly Comic[]): string | undefined {
  return volume.cover || chapters.filter((c) => c.volumeId === volume.id).sort((a, b) => a.chapter - b.chapter)[0]?.cover;
}

/** The formats a comic product is on sale in, online first. */
export function formatsOnSale(product: Pick<ComicProduct, "formats">): ComicFormat[] {
  return (["online", "physical"] as const).filter((f) => product.formats[f].enabled);
}

/** Units sold: apparel's count, or both of a comic's formats together. */
export function unitsSold(product: Product): number {
  return product.type === "comics"
    ? product.formats.online.unitsSold + product.formats.physical.unitsSold
    : product.unitsSold;
}

/**
 * "₦10,000"; "₦10,000 – ₦12,000" for merch with a variant priced differently;
 * for a comic "₦3,000 – ₦10,000" / "Free" / "Not on sale".
 */
export function priceLabel(product: Product): string {
  if (product.type === "apparel") {
    const { lo, hi } = priceRange(product);
    return lo === hi ? formatNaira(lo) : `${formatNaira(lo)} – ${formatNaira(hi)}`;
  }
  const prices = formatsOnSale(product).map((f) => product.formats[f].price);
  if (!prices.length) return "Not on sale";
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const one = (n: number) => (n === 0 ? "Free" : formatNaira(n));
  return lo === hi ? one(lo) : `${one(lo)} – ${one(hi)}`;
}
