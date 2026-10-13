import "server-only";
import type { Comic, ComicVolume, FreeShippingPromo, Product, StateShipping } from "@/types";
import { COMICS, PRODUCTS, VOLUMES } from "@/lib/mock/catalogue";
import { FREE_SHIPPING, SHIPPING } from "@/lib/mock/shipping";
import { NotFoundError, mockDelay } from "./client";

/**
 * Products, and comics: volumes and the chapters compiled into them.
 *
 * MOCK: reads and writes the in-memory fixtures. Writes last until the dev
 * server restarts, which is enough to click through a create-edit-delete flow.
 * Swap each body for `apiFetch` when the endpoints land.
 */

/* ---- Products ---------------------------------------------------------- */

export async function getProducts(): Promise<Product[]> {
  await mockDelay();
  return [...PRODUCTS];
}

export async function getProduct(id: string): Promise<Product> {
  await mockDelay();
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) throw new NotFoundError("Product", id);
  return product;
}

export async function saveProduct(product: Product): Promise<Product> {
  await mockDelay();
  const i = PRODUCTS.findIndex((p) => p.id === product.id);
  if (i === -1) PRODUCTS.unshift(product);
  else PRODUCTS[i] = product;
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  await mockDelay();
  const i = PRODUCTS.findIndex((p) => p.id === id);
  if (i !== -1) PRODUCTS.splice(i, 1);
}

/* ---- Comics ------------------------------------------------------------ */

export async function getComics(): Promise<Comic[]> {
  await mockDelay();
  // Reading order: by volume, then chapter.
  const volumeNo = new Map(VOLUMES.map((v) => [v.id, v.number]));
  return [...COMICS].sort((a, b) => (volumeNo.get(a.volumeId) ?? 0) - (volumeNo.get(b.volumeId) ?? 0) || a.chapter - b.chapter);
}

export async function getComic(id: string): Promise<Comic> {
  await mockDelay();
  const comic = COMICS.find((c) => c.id === id);
  if (!comic) throw new NotFoundError("Comic", id);
  return comic;
}

export async function saveComic(comic: Comic): Promise<Comic> {
  await mockDelay();
  const i = COMICS.findIndex((c) => c.id === comic.id);
  if (i === -1) COMICS.unshift(comic);
  else COMICS[i] = comic;
  return comic;
}

export async function deleteComic(id: string): Promise<void> {
  await mockDelay();
  const i = COMICS.findIndex((c) => c.id === id);
  if (i !== -1) COMICS.splice(i, 1);
}

/* ---- Volumes ----------------------------------------------------------- */

export async function getVolumes(): Promise<ComicVolume[]> {
  await mockDelay();
  return [...VOLUMES].sort((a, b) => a.number - b.number);
}

export async function getVolume(id: string): Promise<ComicVolume> {
  await mockDelay();
  const volume = VOLUMES.find((v) => v.id === id);
  if (!volume) throw new NotFoundError("Volume", id);
  return volume;
}

export async function saveVolume(volume: ComicVolume): Promise<ComicVolume> {
  await mockDelay();
  const i = VOLUMES.findIndex((v) => v.id === volume.id);
  if (i === -1) VOLUMES.push(volume);
  else VOLUMES[i] = volume;
  return volume;
}

export async function deleteVolume(id: string): Promise<void> {
  await mockDelay();
  const i = VOLUMES.findIndex((v) => v.id === id);
  if (i !== -1) VOLUMES.splice(i, 1);
}

/* ---- Shipping ---------------------------------------------------------- */

/** Every state's shipping prices, A to Z. */
export async function getShippingRates(): Promise<StateShipping[]> {
  await mockDelay();
  return [...SHIPPING].sort((a, b) => a.state.localeCompare(b.state));
}

export async function saveStateShipping(rates: StateShipping): Promise<StateShipping> {
  await mockDelay();
  const i = SHIPPING.findIndex((s) => s.state === rates.state);
  if (i === -1) SHIPPING.push(rates);
  else SHIPPING[i] = rates;
  return rates;
}

/** The free shipping promotion. */
export async function getFreeShipping(): Promise<FreeShippingPromo> {
  await mockDelay();
  return { ...FREE_SHIPPING };
}

export async function saveFreeShipping(promo: FreeShippingPromo): Promise<FreeShippingPromo> {
  await mockDelay();
  // Cleared first, so a date taken off the form is gone rather than kept.
  Object.assign(FREE_SHIPPING, { startsAt: undefined, endsAt: undefined }, promo);
  return promo;
}
