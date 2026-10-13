import "server-only";
import { getComics, getProducts, getVolumes } from "@/lib/api/merch";
import { chapterName } from "@/lib/comics";
import type { IssueOption } from "./product-form";

/** Every chapter in Comics, in reading order, marked if a product already sells it. */
export async function getIssueOptions(): Promise<IssueOption[]> {
  const [comics, volumes, products] = await Promise.all([getComics(), getVolumes(), getProducts()]);
  const sold = new Set(products.flatMap((p) => (p.type === "comics" ? [p.comicId] : [])));
  return comics.map((c) => {
    const volume = volumes.find((v) => v.id === c.volumeId);
    return {
      id: c.id,
      label: volume ? `Vol. ${volume.number} · ${chapterName(c)}` : chapterName(c),
      cover: c.cover,
      release: { status: c.status, publishAt: c.publishAt },
      taken: sold.has(c.id),
    };
  });
}
