"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { failureMessage } from "@/lib/api/client";
import {
  UNLINKED,
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
import { chapterName } from "@/lib/comics";
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
  // A listing whose product couldn't be found can't be changed from here.
  if (price?.data && record?.id.startsWith(UNLINKED)) {
    return { error: "This chapter's store product couldn't be found. Reload Comics and try again, or change its prices under Products." };
  }

  try {
    return await saveChapter(id, existing, volume, record, v, price?.data);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the chapter") };
  }
}

/** Saves the chapter, then its price if one was given; redirects to it when it lands. */
async function saveChapter(
  id: string | null,
  existing: Comic | null,
  volume: ComicVolume,
  record: ComicProduct | undefined,
  v: ComicInput,
  pricing: ChapterPricingInput | undefined,
) {
  const comic: Comic = {
    id: existing?.id ?? `cmc_${crypto.randomUUID().slice(0, 8)}`,
    slug: slugify(`${volume.title} ch ${v.chapter} ${v.title}`),
    volumeId: volume.id,
    chapter: v.chapter,
    title: v.title,
    description: v.description,
    status: v.status,
    cover: v.cover,
    coverStyle: v.coverStyle,
    coverTitle: v.coverTitle,
    coverVolume: v.coverVolume,
    coverBand: v.coverBand,
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

  // A new chapter gets its id from the API: everything after this uses the saved one.
  const saved = await saveComic(comic);
  if (pricing) {
    await savePricing(saved, volume, record, pricing);
  }
  refresh();
  redirect(`/comics/${saved.id}`);
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
  await saveProduct(product, !record);
}

export async function deleteComicAction() {
  try {
    await deleteComic();
  } catch (e) {
    return { error: failureMessage(e, "Couldn't delete the chapter") };
  }
  refresh();
  redirect("/comics");
}

/* ---- Volumes ----------------------------------------------------------- */

export async function saveVolumeAction(id: string | null, input: VolumeInput) {
  const parsed = volumeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;

  try {
    return await saveVolumeFromForm(id, v);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the volume") };
  }
}

/** Saves the volume; redirects to it on the Comics page when it lands. */
async function saveVolumeFromForm(id: string | null, v: VolumeInput) {
  const volumes = await getVolumes();
  const clash = volumes.find((x) => x.number === v.number && x.id !== id);
  if (clash) return { error: `Volume ${v.number} already exists: ${clash.title}` };

  const volume: ComicVolume = {
    id: id ?? `vol_${crypto.randomUUID().slice(0, 8)}`,
    number: v.number,
    title: v.title,
    description: v.description,
    cover: v.cover || undefined,
    updatedAt: new Date().toISOString(),
  };

  const saved = await saveVolume(volume);
  refresh();
  redirect(`/comics#vol-${saved.number}`);
}

/** Only an empty volume can go: its chapters must be moved or deleted first. */
export async function deleteVolumeAction(id: string) {
  const chapters = (await getComics()).filter((c) => c.volumeId === id);
  if (chapters.length) {
    return { error: `Move or delete its ${chapters.length} chapter${chapters.length === 1 ? "" : "s"} first` };
  }
  try {
    await deleteVolume();
  } catch (e) {
    return { error: failureMessage(e, "Couldn't delete the volume") };
  }
  refresh();
  redirect("/comics");
}
