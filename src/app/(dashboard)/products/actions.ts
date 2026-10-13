"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteProduct, getComic, getProduct, getProducts, getVolume, saveProduct } from "@/lib/api/merch";
import { chapterName } from "@/lib/comics";
import { STANDARD_COLOURS } from "@/lib/colours";
import { productSchema, type ProductInput } from "@/lib/schemas";
import type { Comic, Product, ProductColour, ProductSize } from "@/types";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function saveProductAction(id: string | null, input: ProductInput) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;

  const existing = id ? await getProduct(id) : null;
  if (existing && existing.type !== v.type) {
    return { error: "A product's type can't change. Create a new product instead." };
  }
  const all = await getProducts();
  const base = {
    id: existing?.id ?? `prd_${crypto.randomUUID().slice(0, 8)}`,
    exclusive: v.exclusive,
    status: v.status,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  let product: Product;
  if (v.type === "comics") {
    // One store listing per chapter; its name and picture are the chapter's own.
    const comic = await getComic(v.comicId).catch(() => null);
    if (!comic) return { error: "That chapter no longer exists" };
    const volume = await getVolume(comic.volumeId).catch(() => undefined);
    const name = chapterName(comic, volume);
    if (all.some((p) => p.type === "comics" && p.comicId === comic.id && p.id !== id)) {
      return { error: `${name} is already in the store` };
    }
    const blocked = v.status === "active" ? onSaleBlocker(comic) : null;
    if (blocked) return { error: blocked };
    const prev = existing?.type === "comics" ? existing.formats : null;
    // Validated already: a format that's on sale has a real price. A switched-off
    // format left blank keeps the price it had.
    const naira = (raw: string, before?: number) => (raw ? Number(raw) : (before ?? 0));
    product = {
      ...base,
      type: "comics",
      comicId: comic.id,
      slug: slugify(name),
      name,
      description: v.description || comic.description,
      image: comic.cover,
      // Units sold are the store's record, never the form's: carried over as they were.
      formats: {
        online: {
          enabled: v.formats.online.enabled,
          free: v.formats.online.free,
          price: v.formats.online.free ? 0 : naira(v.formats.online.price, prev?.online.price),
          unitsSold: prev?.online.unitsSold ?? 0,
        },
        physical: {
          enabled: v.formats.physical.enabled,
          price: naira(v.formats.physical.price, prev?.physical.price),
          stock: v.formats.physical.stock,
          unitsSold: prev?.physical.unitsSold ?? 0,
        },
      },
    };
  } else {
    const slug = slugify(v.name);
    if (all.some((p) => p.slug === slug && p.id !== id)) return { error: "Another product already has that name" };
    // Standard colours by token, added ones with the name and hex the admin gave them.
    const palette: ProductColour[] = [
      ...STANDARD_COLOURS,
      ...v.customColours.map((c) => ({ id: c.id, name: c.name.trim(), hex: c.hex.toLowerCase() })),
    ];
    const colours = v.colours.flatMap((id) => palette.filter((c) => c.id === id));
    product = {
      ...base,
      type: "apparel",
      slug,
      name: v.name,
      description: v.description,
      image: v.image,
      price: v.price,
      colours,
      sizes: v.sizes as ProductSize[],
      stock: v.colours.flatMap((c) =>
        v.sizes.map((size) => {
          const key = `${c}:${size}`;
          // No override typed, or overrides switched off: the variant inherits the product's price.
          const override = v.customPrices && v.prices[key] ? Number(v.prices[key]) : undefined;
          return { colourId: c, size, quantity: v.stock[key] ?? 0, ...(override !== undefined && { price: override }) };
        }),
      ),
      unitsSold: existing?.type === "apparel" ? existing.unitsSold : 0,
    };
  }

  await saveProduct(product);
  revalidatePath("/products");
  revalidatePath("/comics");
  revalidatePath("/");
  redirect("/products");
}

export async function deleteProductAction(id: string) {
  await deleteProduct(id);
  revalidatePath("/products");
  return { ok: true as const };
}

/**
 * Why a comics listing can't go on sale yet, or null. A chapter still in draft
 * has no release, so its listing waits; a scheduled chapter's listing can be
 * Active and goes on sale when the chapter releases.
 */
function onSaleBlocker(comic: Comic): string | null {
  if (comic.status === "draft") {
    return `Chapter ${comic.chapter}: ${comic.title} is still a draft. Schedule or publish it before putting it on sale.`;
  }
  return null;
}

/** "Restore to store" and "Hide from store". Restoring passes the same checks a save does. */
export async function setProductStatusAction(id: string, status: Product["status"]) {
  const product = await getProduct(id);
  if (status === "active" && product.type === "comics") {
    const comic = await getComic(product.comicId).catch(() => null);
    if (!comic) return { error: "That chapter no longer exists" };
    const blocked = onSaleBlocker(comic);
    if (blocked) return { error: blocked };
    if (!product.formats.online.enabled && !product.formats.physical.enabled) {
      return { error: "Sell it online, in print, or both before it goes live" };
    }
  }
  await saveProduct({ ...product, status });
  revalidatePath("/products");
  return { ok: true as const };
}
