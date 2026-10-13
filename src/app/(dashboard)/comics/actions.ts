"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteComic,
  deleteVolume,
  getComic,
  getComics,
  getProducts,
  getVolume,
  getVolumes,
  saveComic,
  saveProduct,
  saveVolume,
} from "@/lib/api/merch";
import { chapterName, volumeCompleteness } from "@/lib/comics";
import {
  chapterPricingSchema,
  comicSchema,
  volumeSchema,
  type ChapterPricingInput,
  type ComicInput,
  type VolumeInput,
} from "@/lib/schemas";
import { fromLagosInput } from "@/lib/lagos-time";
import type { Comic, ComicProduct, ComicVolume } from "@/types";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function refresh() {
  revalidatePath("/comics");
  revalidatePath("/products");
}

/**
 * A chapter's store listing is named after it and its volume. When either
 * is renamed or renumbered, the listing follows, so the two never disagree.
 */
async function syncListings(chapters: Comic[], volume: ComicVolume) {
  const ids = new Set(chapters.map((c) => c.id));
  for (const p of await getProducts()) {
    if (p.type !== "comics" || !ids.has(p.comicId)) continue;
    const c = chapters.find((x) => x.id === p.comicId)!;
    const name = chapterName(c, volume);
    await saveProduct({ ...p, name, slug: slugify(name), image: c.cover });
  }
}

/* ---- Chapters ---------------------------------------------------------- */

/** Whether a chapter can be bought: its store record is on sale in at least one format. */
function isPriced(p: ComicProduct | undefined): boolean {
  return !!p && p.status === "active" && (p.formats.online.enabled || p.formats.physical.enabled);
}

/**
 * A chapter can't be scheduled or published without a price. The chapter
 * form asks for one in its price prompt and sends it as `pricing`; it is saved
 * to the chapter's store record, on sale from release. Nothing else lists it.
 */
export async function saveComicAction(id: string | null, input: ComicInput, pricing?: ChapterPricingInput) {
  const parsed = comicSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  const price = pricing ? chapterPricingSchema.safeParse(pricing) : null;
  if (price && !price.success) return { error: price.error.issues[0]?.message ?? "Check the price" };

  const existing = id ? await getComic(id) : null;
  const volume = await getVolume(v.volumeId).catch(() => null);
  if (!volume) return { error: "That volume no longer exists" };
  const clash = (await getComics()).find((c) => c.volumeId === v.volumeId && c.chapter === v.chapter && c.id !== id);
  if (clash) return { error: `Volume ${volume.number} already has a Chapter ${v.chapter}: ${clash.title}` };

  const record = id
    ? (await getProducts()).find((p): p is ComicProduct => p.type === "comics" && p.comicId === id)
    : undefined;
  if (v.status !== "draft" && !price?.data && !isPriced(record)) {
    return { error: "Add a price before this chapter can be scheduled or published" };
  }

  const comic: Comic = {
    id: existing?.id ?? `cmc_${crypto.randomUUID().slice(0, 8)}`,
    slug: slugify(`${volume.title} ch ${v.chapter} ${v.title}`),
    volumeId: volume.id,
    chapter: v.chapter,
    title: v.title,
    description: v.description,
    status: v.status,
    cover: v.cover,
    pages: v.pages.map((p, i) => ({ id: p.id, src: p.src, number: i + 1 })),
    publishAt:
      v.status === "scheduled"
        ? fromLagosInput(v.publishAt!)
        : v.status === "published"
          ? // Already out keeps its release date; publishing early (or a draft) releases it now.
            existing?.status === "published" && existing.publishAt
            ? existing.publishAt
            : new Date().toISOString()
          : undefined,
    reads: existing?.reads ?? 0,
    updatedAt: new Date().toISOString(),
  };

  await saveComic(comic);
  if (price?.data) {
    await savePricing(comic, volume, record, price.data);
  } else if (v.status === "draft" && record?.status === "active") {
    // Back in draft, it has no release to sell from: off sale until it's released again.
    await saveProduct({ ...record, status: "draft" });
  }
  await syncListings([comic], volume);
  await pauseIfIncomplete(volume);
  refresh();
  redirect(`/comics/${comic.id}`);
}

/**
 * A printed volume is sold only while every chapter is out. When a chapter
 * save leaves its volume incomplete - a new chapter, or one back in draft - the
 * printed volume comes off sale, with the reason shown on the volume's page.
 */
async function pauseIfIncomplete(volume: ComicVolume) {
  if (!volume.edition?.enabled) return;
  const done = volumeCompleteness(volume.id, await getComics());
  if (done.complete) return;
  const why = done.waiting ? `Chapter ${done.waiting.chapter}: ${done.waiting.title} isn't published` : "The volume has no chapters";
  await saveVolume({ ...volume, edition: { ...volume.edition, enabled: false, pausedReason: why } });
}

/** The price prompt's answer, on the chapter's store record: created if new, on sale from release. */
async function savePricing(comic: Comic, volume: ComicVolume, record: ComicProduct | undefined, { formats }: ChapterPricingInput) {
  const naira = (raw: string, before?: number) => (raw ? Number(raw) : (before ?? 0));
  const name = chapterName(comic, volume);
  const product: ComicProduct = {
    id: record?.id ?? `prd_${crypto.randomUUID().slice(0, 8)}`,
    type: "comics",
    comicId: comic.id,
    slug: slugify(name),
    name,
    description: record?.description || comic.description,
    image: comic.cover,
    exclusive: record?.exclusive ?? false,
    status: "active",
    createdAt: record?.createdAt ?? new Date().toISOString(),
    formats: {
      online: {
        enabled: formats.online.enabled,
        free: formats.online.free,
        price: formats.online.free ? 0 : naira(formats.online.price, record?.formats.online.price),
        unitsSold: record?.formats.online.unitsSold ?? 0,
      },
      physical: {
        enabled: formats.physical.enabled,
        price: naira(formats.physical.price, record?.formats.physical.price),
        stock: formats.physical.stock,
        unitsSold: record?.formats.physical.unitsSold ?? 0,
      },
    },
  };
  await saveProduct(product);
}

export async function deleteComicAction(id: string) {
  await deleteComic(id);
  refresh();
  redirect("/comics");
}

/* ---- Volumes ----------------------------------------------------------- */

export async function saveVolumeAction(id: string | null, input: VolumeInput) {
  const parsed = volumeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;

  const volumes = await getVolumes();
  const clash = volumes.find((x) => x.number === v.number && x.id !== id);
  if (clash) return { error: `Volume ${v.number} already exists: ${clash.title}` };

  // The printed volume goes on sale only once every chapter is published.
  const before = id ? volumes.find((x) => x.id === id) : undefined;
  if (v.editionEnabled) {
    const done = volumeCompleteness(id ?? "", await getComics());
    if (!done.complete) {
      return {
        error: done.total
          ? `Only ${done.published} of ${done.total} chapters are published. The printed volume can go on sale once every chapter is out.`
          : "Add and publish this volume's chapters before selling it in print.",
      };
    }
  }

  const volume: ComicVolume = {
    id: id ?? `vol_${crypto.randomUUID().slice(0, 8)}`,
    number: v.number,
    title: v.title,
    description: v.description,
    cover: v.cover || undefined,
    // Kept when switched off, so its price and sales survive; a blank price keeps the old one.
    edition:
      v.editionEnabled || before?.edition
        ? {
            enabled: v.editionEnabled,
            price: v.editionPrice ? Number(v.editionPrice) : (before?.edition?.price ?? 0),
            stock: v.editionStock,
            unitsSold: before?.edition?.unitsSold ?? 0,
          }
        : undefined,
    updatedAt: new Date().toISOString(),
  };

  await saveVolume(volume);
  if (id) await syncListings((await getComics()).filter((c) => c.volumeId === id), volume);
  refresh();
  redirect(`/comics#vol-${volume.number}`);
}

/** Only an empty volume can go: its chapters must be moved or deleted first. */
export async function deleteVolumeAction(id: string) {
  const chapters = (await getComics()).filter((c) => c.volumeId === id);
  if (chapters.length) {
    return { error: `Move or delete its ${chapters.length} chapter${chapters.length === 1 ? "" : "s"} first` };
  }
  await deleteVolume(id);
  refresh();
  redirect("/comics");
}
