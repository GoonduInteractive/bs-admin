import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { Comic, ComicProduct, ComicStats, ComicStatus, ComicVolume, CoverBand } from "@/types";
import { chapterName } from "@/lib/comics";
import { COVER_BAND } from "@/lib/labels";
import { ApiError, NotFoundError, apiFetch, apiFetchAll, fromMinor } from "./client";

/**
 * Comics: volumes, and the chapters compiled into them.
 *
 * `GET /v1/admin/comics` lists the volumes with their chapters, and each
 * chapter carries its store listing (`product`: status and prices), so the
 * listings come from here too (`getComicListings`). Volumes are created and
 * edited (`POST /v1/admin/comics`, `PATCH /{id}/edit`), chapters likewise
 * (`POST /{id}/chapters`, `PATCH /{id}/chapters/{chapter_id}/edit`). The API
 * can't delete either yet, and has no printed-volume edition.
 *
 * Volumes carry their title and number, chapters their description and
 * `page_urls` (spec of 2026-10-22). Older replies lacked them, so a missing
 * title still falls back to the slug and a missing number to the list order.
 *
 * FLAGGED: a chapter's Cover style (`cover_style`, `cover_title`,
 * `cover_volume_label`, `cover_band`) was asked of the backend on 2026-10-30.
 * It's sent with every save, and the API ignores fields it doesn't know; the
 * form's controls stay off until the replies carry it (`getCoverStylesSaved`).
 */

/* ---- The API's shapes -------------------------------------------------- */

/** A listing's format. `price_minor` may be null: not priced yet. */
const apiVariant = z.object({ fulfillment: z.string(), price_minor: z.coerce.number().nullable().default(null), stock: z.coerce.number().nullish() });

const apiListing = z
  .object({
    id: z.string().optional(),
    status: z.enum(["archived", "draft", "published"]),
    variants: z.array(apiVariant).default([]),
  })
  .nullish();

const apiPage = z.union([z.string(), z.object({ url: z.string() }).transform((p) => p.url)]);

const apiChapter = z.object({
  id: z.string(),
  status: z.string(),
  number: z.coerce.number(),
  title: z.string(),
  slug: z.string().optional(),
  description: z.string().nullish(),
  cover_image_url: z.string().nullish(),
  page_urls: z.array(z.string()).optional(),
  pages: z.array(apiPage).optional(),
  reads: z.coerce.number().optional(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  released_at: z.string().nullish(),
  scheduled_at: z.string().nullish(),
  cover_style: z.string().nullish(),
  cover_title: z.string().nullish(),
  cover_volume_label: z.string().nullish(),
  cover_band: z.string().nullish(),
  product: apiListing,
});
type ApiChapter = z.output<typeof apiChapter>;

const apiVolume = z.object({
  id: z.string(),
  slug: z.string().optional(),
  title: z.string().optional(),
  num: z.coerce.number().optional(),
  number: z.coerce.number().optional(),
  description: z.string().nullish(),
  cover_image_url: z.string().nullish(),
  chapters: z.array(apiChapter).default([]),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});
type ApiVolume = z.output<typeof apiVolume>;

/* ---- Mapping ----------------------------------------------------------- */

/** "volume-one-origins" -> "Volume One Origins": a stand-in until the reply carries the title. */
const fromSlug = (slug = "") => slug.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const STATUS: Record<string, ComicStatus> = { published: "published", scheduled: "scheduled" };

function toChapter(c: ApiChapter, volumeId: string): Comic {
  const status = STATUS[c.status] ?? "draft";
  const pages = c.page_urls ?? c.pages ?? [];
  return {
    id: c.id,
    slug: c.slug ?? c.id,
    volumeId,
    chapter: c.number,
    title: c.title,
    description: c.description ?? "",
    status,
    cover: c.cover_image_url ?? "",
    coverStyle: c.cover_style === "full" ? "full" : "torn",
    coverTitle: c.cover_title ?? "",
    ...(c.cover_volume_label != null && { coverVolume: c.cover_volume_label }),
    ...(c.cover_band && c.cover_band in COVER_BAND && { coverBand: c.cover_band as CoverBand }),
    pages: pages.map((src, i) => ({ id: `${c.id}-p${i + 1}`, number: i + 1, src })),
    ...((status === "scheduled" ? c.scheduled_at : c.released_at) && { publishAt: (status === "scheduled" ? c.scheduled_at : c.released_at)! }),
    reads: c.reads ?? 0,
    ...((c.updated_at ?? c.created_at) && { updatedAt: (c.updated_at ?? c.created_at)! }),
  };
}

function toVolume(v: ApiVolume, fallbackNumber: number): ComicVolume {
  return {
    id: v.id,
    number: v.num ?? v.number ?? fallbackNumber,
    title: v.title ?? fromSlug(v.slug),
    description: v.description ?? "",
    ...(v.cover_image_url && { cover: v.cover_image_url }),
    ...((v.updated_at ?? v.created_at) && { updatedAt: (v.updated_at ?? v.created_at)! }),
  };
}

/**
 * Each comic product's id, by the chapter it sells. The comics endpoint gives a
 * chapter's listing without its product id, and the product list doesn't name
 * the chapter: only a product's own detail does (`chapter.id`). So the comic
 * products' details are read, once per request, to join the two (seen 2026-11-07).
 */
const comicProductIds = cache(async (): Promise<Map<string, string>> => {
  const rows = await apiFetchAll("/v1/admin/products", z.object({ id: z.string(), type: z.string() }));
  const details = await Promise.all(
    rows
      .filter((r) => r.type === "comic")
      .map((r) =>
        apiFetch(`/v1/admin/products/${encodeURIComponent(r.id)}`, z.object({ id: z.string(), chapter: z.object({ id: z.string() }).nullish() })).catch(
          () => null,
        ),
      ),
  );
  return new Map(details.flatMap((d) => (d?.chapter ? [[d.chapter.id, d.id] as const] : [])));
});

/** A chapter's store listing, as the comics screens and the product form read it. */
function toListing(c: ApiChapter, chapter: Comic, volume: ComicVolume, productId: string | undefined): ComicProduct | undefined {
  if (!c.product) return undefined;
  const digital = c.product.variants.find((v) => v.fulfillment === "digital");
  const print = c.product.variants.find((v) => v.fulfillment === "physical");
  const name = chapterName(chapter, volume);
  return {
    // The product's own id (`comicProductIds`). One it couldn't find keeps a stand-in: such a
    // listing can be shown, not opened or changed.
    id: c.product.id ?? productId ?? `${UNLINKED}${c.id}`,
    type: "comics",
    comicId: c.id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name,
    description: chapter.description,
    image: chapter.cover,
    exclusive: false,
    status: c.product.status === "published" ? "active" : c.product.status,
    createdAt: c.created_at ?? "",
    // Sales per chapter aren't in the reply: the page's copies-sold total comes from the stats.
    formats: {
      online: { enabled: !!digital, free: digital?.price_minor === 0, price: fromMinor(digital?.price_minor ?? 0), unitsSold: 0 },
      physical: { enabled: !!print, price: fromMinor(print?.price_minor ?? 0), stock: print?.stock ?? 0, unitsSold: 0 },
    },
  };
}

/** A listing whose product id couldn't be found: its id starts with this. */
export const UNLINKED = "chapter-";

/** Every volume with its chapters and listings, fetched once per request. */
const catalogue = cache(async () => {
  const [list, productIds] = await Promise.all([apiFetchAll("/v1/admin/comics", apiVolume), comicProductIds()]);
  // Volume order: the number the reply gives (it does: `number`), else the order it lists them in.
  const raw = list.map((v, i) => ({ v, n: v.num ?? v.number ?? i + 1 })).sort((a, b) => a.n - b.n);
  const volumes: ComicVolume[] = [];
  const chapters: Comic[] = [];
  const listings: ComicProduct[] = [];
  // A reply that names a cover style, even as null, is one from an API that saves it.
  const coverStyles = raw.some(({ v }) => v.chapters.some((c) => c.cover_style !== undefined));
  raw.forEach(({ v, n }) => {
    const volume = toVolume(v, n);
    volumes.push(volume);
    for (const c of v.chapters) {
      const chapter = toChapter(c, v.id);
      chapters.push(chapter);
      const listing = toListing(c, chapter, volume, productIds.get(c.id));
      if (listing) listings.push(listing);
    }
  });
  return { volumes, chapters, listings, coverStyles };
});

/* ---- Reads ------------------------------------------------------------- */

/** Reading order: by volume, then chapter. */
export async function getComics(): Promise<Comic[]> {
  const [chapters, volumes] = await catalogue().then((c) => [c.chapters, c.volumes] as const);
  const volumeNo = new Map(volumes.map((v) => [v.id, v.number]));
  return [...chapters].sort((a, b) => (volumeNo.get(a.volumeId) ?? 0) - (volumeNo.get(b.volumeId) ?? 0) || a.chapter - b.chapter);
}

/** One chapter: its own endpoint, which may carry the pages and description the list leaves out. */
export async function getComic(id: string): Promise<Comic> {
  const listed = (await catalogue()).chapters.find((c) => c.id === id);
  if (!listed) throw new NotFoundError("Comic", id);
  const detail = await apiFetch(`/v1/admin/comics/${encodeURIComponent(listed.volumeId)}/chapters/${encodeURIComponent(id)}`, apiChapter);
  const chapter = toChapter(detail, listed.volumeId);
  return { ...chapter, pages: chapter.pages.length ? chapter.pages : listed.pages, description: chapter.description || listed.description };
}

/** Whether a chapter's Cover style is kept when saved: once the API's replies carry it. */
export async function getCoverStylesSaved(): Promise<boolean> {
  return (await catalogue()).coverStyles;
}

export async function getVolumes(): Promise<ComicVolume[]> {
  const volumes = (await catalogue()).volumes;
  return [...volumes].sort((a, b) => a.number - b.number);
}

export async function getVolume(id: string): Promise<ComicVolume> {
  const volume = (await catalogue()).volumes.find((v) => v.id === id);
  if (!volume) throw new NotFoundError("Volume", id);
  return volume;
}

/** The chapters' store listings, read off the chapters. */
export async function getComicListings(): Promise<ComicProduct[]> {
  return (await catalogue()).listings;
}

export async function getComicStats(): Promise<ComicStats> {
  const s = await apiFetch(
    "/v1/admin/comics/stats",
    z.object({
      volumes: z.number(),
      chapters_total: z.number(),
      published_chapters: z.number(),
      unpublished_chapters: z.number(),
      reads: z.number(),
      copies_sold: z.number(),
      chapters_in_store: z.number(),
    }),
  );
  return {
    volumes: s.volumes,
    chapters: s.chapters_total,
    published: s.published_chapters,
    unpublished: s.unpublished_chapters,
    reads: s.reads,
    copiesSold: s.copies_sold,
    inStore: s.chapters_in_store,
  };
}

/* ---- Writes ------------------------------------------------------------ */

const isUrl = (s: string | undefined): s is string => !!s && /^https?:\/\//.test(s);

export async function saveVolume(volume: ComicVolume): Promise<ComicVolume> {
  const exists = (await catalogue()).volumes.some((v) => v.id === volume.id);
  const body = {
    num: volume.number,
    title: volume.title,
    description: volume.description,
    ...(isUrl(volume.cover) && { cover_image_url: volume.cover }),
  };
  const saved = exists
    ? await apiFetch(`/v1/admin/comics/${encodeURIComponent(volume.id)}/edit`, apiVolume, { method: "PATCH", body })
    : await apiFetch("/v1/admin/comics", apiVolume, { method: "POST", body });
  // The reply may not carry the title and number; the ones just saved are the truth.
  return { ...toVolume(saved, volume.number), number: volume.number, title: volume.title };
}

/** The API has no endpoint to delete a volume yet: the admin is told so. */
export async function deleteVolume(): Promise<never> {
  throw new Error("The server can't delete volumes yet.");
}

/**
 * Create or update a chapter; returns it as saved, with the id the API gave a
 * new one. The cover and pages must be uploaded files (full URLs).
 */
export async function saveComic(comic: Comic): Promise<Comic> {
  const listed = (await catalogue()).chapters.find((c) => c.id === comic.id);
  if (listed && listed.volumeId !== comic.volumeId) throw new Error("The server can't move a chapter to another volume yet.");
  const body = {
    num: comic.chapter,
    title: comic.title,
    description: comic.description,
    cover_image_url: comic.cover,
    cover_style: comic.coverStyle ?? "torn",
    cover_title: comic.coverTitle ?? "",
    cover_volume_label: comic.coverVolume ?? "",
    cover_band: comic.coverBand ?? "menu",
    page_urls: comic.pages.map((p) => p.src),
    release: comic.status,
    ...(comic.status === "scheduled" && comic.publishAt && { scheduled_at: comic.publishAt }),
  };
  const volume = encodeURIComponent(comic.volumeId);
  if (listed) {
    const saved = await apiFetch(`/v1/admin/comics/${volume}/chapters/${encodeURIComponent(comic.id)}/edit`, apiChapter, { method: "PATCH", body });
    return toChapter(saved, comic.volumeId);
  }
  // Creating answers with the whole volume; the new chapter is the one with this number.
  const saved = await apiFetch(`/v1/admin/comics/${volume}/chapters`, apiVolume, { method: "POST", body });
  const created = saved.chapters.find((c) => c.number === comic.chapter);
  if (!created) throw new ApiError(502, "The chapter was saved, but the server's reply doesn't include it. Reload Comics to see it.");
  return toChapter(created, comic.volumeId);
}

/** The API has no endpoint to delete a chapter yet: the admin is told so. */
export async function deleteComic(): Promise<never> {
  throw new Error("The server can't delete chapters yet.");
}

/**
 * Prices for a chapter's listing, in naira (`price`, since 2026-11-02). A free
 * chapter is `free_to_read` with no price: the API's online price is at least 1.
 */
export function salesBody(formats: ComicProduct["formats"]) {
  return {
    ...(formats.online.enabled && {
      online: formats.online.free ? { free_to_read: true } : { price: formats.online.price, free_to_read: false },
    }),
    ...(formats.physical.enabled && { physical: { price: formats.physical.price, stock: formats.physical.stock } }),
  };
}
