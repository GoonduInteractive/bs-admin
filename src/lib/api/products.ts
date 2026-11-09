import "server-only";
import { z } from "zod";
import type { ComicFormat, Product, ProductColour, ProductRow, ProductSize, ProductStats, ProductStatus, StockStatus } from "@/types";
import { STANDARD_COLOURS } from "@/lib/colours";
import { formatNaira } from "@/lib/format";
import { ApiError, NotFoundError, apiFetch, apiFetchAll, fromMinor } from "./client";
import { getComicListings, salesBody } from "./comics";

/**
 * Store products: Merch (`apparel`) and Comics, one listing per chapter.
 *
 * `GET /v1/admin/products` lists them as summaries (no variants), which
 * is what the Products table shows; `GET /stats` gives its headline figures;
 * `POST` creates one, `GET /{id}` loads it whole and `PUT /{id}` changes it
 * (visibility included). The API can't delete one yet. The comics screens read
 * chapters' listings off the comics endpoint instead (`getComicListings`).
 */

const API_STATUS = { published: "active", draft: "draft", archived: "archived" } as const satisfies Record<string, ProductStatus>;
const TO_API_STATUS: Record<ProductStatus, keyof typeof API_STATUS> = { active: "published", draft: "draft", archived: "archived" };
const API_STOCK: Record<string, StockStatus | null> = { in_stock: "inStock", low_stock: "lowStock", out_of_stock: "outOfStock", digital_only: null };

const apiProduct = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  cover_image_url: z.string().nullish(),
  type: z.enum(["apparel", "comic"]),
  status: z.enum(["archived", "draft", "published"]),
  exclusive: z.boolean(),
  price_minor: z.coerce.number(),
  online_price_minor: z.coerce.number().nullish(),
  physical_price_minor: z.coerce.number().nullish(),
  in_stock: z.coerce.number().nullish(),
  stock_status: z.enum(["in_stock", "low_stock", "out_of_stock", "digital_only"]),
  sold: z.coerce.number(),
  created_at: z.string(),
});

/** "₦3,000", "₦3,000 – ₦10,000", "Free", or "Not on sale". */
function labelFor(prices: number[]): string {
  if (!prices.length) return "Not on sale";
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const one = (n: number) => (n === 0 ? "Free" : formatNaira(n));
  return lo === hi ? one(lo) : `${one(lo)} – ${one(hi)}`;
}

function toRow(p: z.output<typeof apiProduct>): ProductRow {
  const comics = p.type === "comic";
  const formats: ProductRow["formats"] = comics
    ? (
        [
          ["online", p.online_price_minor],
          ["physical", p.physical_price_minor],
        ] as [ComicFormat, number | null | undefined][]
      ).flatMap(([format, minor]) => (minor == null ? [] : [{ format, price: fromMinor(minor), free: minor === 0 }]))
    : [];
  const prices = comics ? formats.map((f) => f.price) : [fromMinor(p.price_minor)];
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    description: p.description ?? "",
    image: p.cover_image_url ?? "",
    type: comics ? "comics" : "apparel",
    status: API_STATUS[p.status],
    exclusive: p.exclusive,
    priceLabel: labelFor(prices),
    priceFrom: prices.length ? Math.min(...prices) : null,
    formats,
    stock: p.in_stock ?? null,
    stockStatus: API_STOCK[p.stock_status] ?? null,
    sold: p.sold,
    createdAt: p.created_at,
  };
}

/** Every product, as the Products table lists them. */
export async function getProductRows(): Promise<ProductRow[]> {
  return (await apiFetchAll("/v1/admin/products", apiProduct)).map(toRow);
}

const apiStats = z.object({
  live_products: z.object({ total: z.number(), merch: z.number(), comics: z.number() }),
  units_sold: z.object({ total: z.number(), merch: z.number(), comics: z.number() }),
  needs_restock: z.object({ count: z.number(), titles: z.array(z.string()) }),
  stock_value_minor: z.number(),
});

export async function getProductStats(): Promise<ProductStats> {
  const s = await apiFetch("/v1/admin/products/stats", apiStats);
  return { live: s.live_products, sold: s.units_sold, restock: s.needs_restock, stockValue: fromMinor(s.stock_value_minor) };
}

/* ---- Whole products ---------------------------------------------------- */

/** Whole products: only the comics listings (read off their chapters); merch isn't served whole. */
export async function getProducts(): Promise<Product[]> {
  return getComicListings();
}

/* ---- One product, whole ----------------------------------------------- */

const apiVariant = z.object({
  id: z.string(),
  fulfillment: z.enum(["digital", "physical"]),
  color: z.string().nullish(),
  size: z.string().nullish(),
  stock: z.coerce.number().nullish(),
  price_minor: z.coerce.number().nullish(),
});

const apiProductDetail = z.object({
  id: z.string(),
  type: z.enum(["apparel", "comic"]),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullish(),
  price_minor: z.coerce.number(),
  cover_image_url: z.string().nullish(),
  status: z.enum(["archived", "draft", "published"]),
  exclusive: z.boolean(),
  created_at: z.string(),
  variants: z.array(apiVariant).default([]),
  chapter: z.object({ id: z.string() }).nullish(),
});
type ApiProductDetail = z.output<typeof apiProductDetail>;

const SIZES: readonly ProductSize[] = ["XS", "S", "M", "L", "XL", "XXL"];
const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * A colour the API names. One of the standard three keeps its token; any other
 * becomes a custom colour with an id from its name (so it is the same on every
 * load) and a neutral swatch: the API keeps a colour's name, not its hex.
 */
function colourFor(name: string): ProductColour {
  const standard = STANDARD_COLOURS.find((c) => same(c.name, name));
  if (standard) return standard;
  const tail = [...name.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  return { id: `cus_${tail.padStart(4, "0")}`, name, hex: "#9ca3af" };
}

/** The API's whole product as the edit form needs it. `sold` is the list's figure: the detail has none. */
function toProduct(d: ApiProductDetail, sold: number): Product {
  const base = {
    id: d.id,
    slug: d.slug,
    name: d.title,
    description: d.description ?? "",
    image: d.cover_image_url ?? "",
    exclusive: d.exclusive,
    status: API_STATUS[d.status],
    createdAt: d.created_at,
  };
  if (d.type === "comic") {
    const online = d.variants.find((v) => v.fulfillment === "digital");
    const print = d.variants.find((v) => v.fulfillment === "physical");
    return {
      ...base,
      type: "comics",
      comicId: d.chapter?.id ?? "",
      // Sold per format isn't served; the total sits with the online edition.
      formats: {
        online: { enabled: !!online, free: online?.price_minor === 0, price: fromMinor(online?.price_minor ?? 0), unitsSold: sold },
        physical: { enabled: !!print, price: fromMinor(print?.price_minor ?? 0), stock: print?.stock ?? 0, unitsSold: 0 },
      },
    };
  }
  const colours = [...new Map(d.variants.flatMap((v) => (v.color ? [[v.color.toLowerCase(), colourFor(v.color)] as const] : []))).values()];
  const sizes = SIZES.filter((size) => d.variants.some((v) => same(v.size, size)));
  return {
    ...base,
    type: "apparel",
    price: fromMinor(d.price_minor),
    colours,
    sizes,
    stock: d.variants.flatMap((v) => {
      const size = SIZES.find((x) => same(v.size, x));
      if (!v.color || !size) return [];
      const own = v.price_minor != null && v.price_minor !== d.price_minor;
      return [{ colourId: colourFor(v.color).id, size, quantity: v.stock ?? 0, ...(own && { price: fromMinor(v.price_minor!) }) }];
    }),
    unitsSold: sold,
  };
}

const getApiProduct = (id: string) => apiFetch(`/v1/admin/products/${encodeURIComponent(id)}`, apiProductDetail);

export async function getProduct(id: string): Promise<Product> {
  try {
    const [detail, rows] = await Promise.all([getApiProduct(id), getProductRows()]);
    return toProduct(detail, rows.find((r) => r.id === id)?.sold ?? 0);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) throw new NotFoundError("Product", id);
    throw e;
  }
}

const isUrl = (s: string | undefined): s is string => !!s && /^https?:\/\//.test(s);

/**
 * The create or update request for a product, in the API's terms. On an update,
 * `current` gives each variant its id. Prices go in NAIRA (`price`, since
 * 2026-11-02; `price_minor` before); replies still give kobo.
 */
function productBody(p: Product, current?: ApiProductDetail) {
  const base = {
    visibility: TO_API_STATUS[p.status],
    make_exclusive: p.exclusive,
    title: p.name,
    description: p.description,
    ...(isUrl(p.image) && { cover_image_url: p.image }),
  };
  if (p.type === "comics") {
    // Its title and cover follow the chapter; its store text is `store_description` (`description` is apparel's).
    return {
      visibility: base.visibility,
      make_exclusive: base.make_exclusive,
      store_description: p.description,
      type: "comic",
      chapter_id: p.comicId,
      sales: salesBody(p.formats),
    };
  }
  const colour = (id: string) => p.colours.find((c) => c.id === id)?.name ?? id;
  return {
    ...base,
    type: "apparel",
    price: p.price,
    variants: p.stock.map((v) => {
      const color = colour(v.colourId);
      const id = current?.variants.find((x) => same(x.color, color) && same(x.size, v.size))?.id;
      return { ...(id && { id }), color, size: v.size, stock: v.quantity, ...(v.price !== undefined && { price: v.price }) };
    }),
  };
}

/** Save a product. `isNew` says whether it's being created (`POST`) or changed (`PUT /{id}`). */
export async function saveProduct(product: Product, isNew = false): Promise<Product> {
  if (isNew) {
    await apiFetch("/v1/admin/products", z.unknown(), { method: "POST", body: productBody(product) });
  } else {
    // `type` and a comic's chapter are fixed once created; the update takes the rest.
    const body: Record<string, unknown> = { ...productBody(product, await getApiProduct(product.id)) };
    delete body.type;
    delete body.chapter_id;
    await apiFetch(`/v1/admin/products/${encodeURIComponent(product.id)}`, z.unknown(), { method: "PUT", body });
  }
  return product;
}

/** The API has no endpoint to delete a product yet: the admin is told so. */
export async function deleteProduct(): Promise<never> {
  throw new Error("The server can't delete products yet.");
}
