import type { ApparelProduct, Comic, ComicProduct, ComicVolume, Product, ProductColour, ProductSize, ProductVariantStock } from "@/types";
import { STANDARD_COLOURS } from "@/lib/colours";
import { daysAgo, daysFromNow } from "./random";

/**
 * Merch and comics. Product names, prices, colourways and the two comic
 * volumes are the public store's own; stock counts and sales are invented.
 *
 * Products are the backend's two types: APPAREL (below) and COMICS, which
 * sell a chapter from COMICS (further down) online, in print, or both.
 */

const COLOURS: ProductColour[] = [...STANDARD_COLOURS];

const SIZES: ProductSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** A stock grid from a per-size base, so each product has a believable spread. */
function stockGrid(base: number[], colours = COLOURS, sizes = SIZES): ProductVariantStock[] {
  return colours.flatMap((colour, c) =>
    sizes.map((size, s) => ({
      colourId: colour.id,
      size,
      quantity: Math.max(0, (base[s] ?? 0) - c * 2),
    })),
  );
}

const APPAREL: ApparelProduct[] = [
  {
    id: "prd_hoodie",
    slug: "goondu-hoodie",
    name: "Goondu Hoodie",
    description:
      "Heavyweight oversized hoodie in double-woven 100% cotton, with the Goondu wordmark across the chest.",
    type: "apparel",
    price: 10_000,
    image: "/assets/merch/hoodie.png",
    exclusive: true,
    status: "active",
    colours: COLOURS,
    sizes: SIZES,
    stock: stockGrid([2, 6, 12, 10, 7, 3]),
    unitsSold: 312,
    createdAt: daysAgo(96),
  },
  {
    id: "prd_tee",
    slug: "goondu-tee",
    name: "Goondu Tee",
    description: "Everyday cotton tee with the studio wordmark across the chest.",
    type: "apparel",
    price: 10_000,
    image: "/assets/merch/tee.png",
    exclusive: false,
    status: "active",
    colours: COLOURS,
    sizes: SIZES,
    stock: stockGrid([8, 18, 26, 24, 15, 6]),
    unitsSold: 488,
    createdAt: daysAgo(96),
  },
  {
    id: "prd_tote",
    slug: "goondu-tote",
    name: "Goondu Tote",
    description: "Black canvas tote with the studio wordmark and a red Nsibidi pattern.",
    type: "apparel",
    price: 10_000,
    image: "/assets/merch/tote.png",
    exclusive: false,
    status: "active",
    colours: COLOURS.slice(0, 1),
    sizes: ["M"],
    stock: [{ colourId: "black", size: "M", quantity: 4 }],
    unitsSold: 204,
    createdAt: daysAgo(80),
  },
  {
    id: "prd_beanie",
    slug: "goondu-beanie",
    name: "Goondu Beanie",
    description: "Ribbed knit beanie with the studio wordmark on the cuff.",
    type: "apparel",
    price: 10_000,
    image: "/assets/merch/beanie.png",
    exclusive: false,
    status: "active",
    colours: [COLOURS[0], COLOURS[2]],
    sizes: ["M"],
    stock: [
      { colourId: "black", size: "M", quantity: 0 },
      { colourId: "white", size: "M", quantity: 0 },
    ],
    unitsSold: 156,
    createdAt: daysAgo(80),
  },
];

/** The reader art Goondu delivered. One page exists, so it is repeated. */
const PAGE_ART = ["/assets/comics/c1.png"];

function pages(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}_p${i + 1}`,
    number: i + 1,
    src: PAGE_ART[i % PAGE_ART.length],
  }));
}

/**
 * Volume 1 collects the Trial chapters; its title and synopsis are the public
 * site's. Chapter titles are placeholders: "Testing Waters" is the team's
 * example, and Chapters 2 and 3 keep the titles they had as issues.
 */
export const VOLUMES: ComicVolume[] = [
  {
    id: "vol_trial",
    number: 1,
    title: "Trial of the Gods",
    description:
      "Soma was an ordinary young man completing his national youth service when tragedy struck. Caught between life and death, Soma encountered Ogbun'abali, the Igbo deity of punishment and games.",
    updatedAt: daysAgo(3, 15),
  },
];

/** Chapters. Each is one comic book, read online and sold online or in print. */
export const COMICS: Comic[] = [
  {
    id: "cmc_trial",
    slug: "trial-of-the-gods-ch-1-testing-waters",
    volumeId: "vol_trial",
    chapter: 1,
    title: "Testing Waters",
    description:
      "Soma was an ordinary young man completing his national youth service when tragedy struck. Caught between life and death, Soma encountered Ogbun'abali, the Igbo deity of punishment and games.",
    status: "published",
    cover: "/assets/characters/soma-3d.png",
    pages: pages("cmc_trial", 12),
    publishAt: daysAgo(28, 9),
    reads: 4_812,
    updatedAt: daysAgo(3, 15),
  },
  {
    id: "cmc_between",
    slug: "trial-of-the-gods-ch-2-between-worlds",
    volumeId: "vol_trial",
    chapter: 2,
    title: "Between Worlds",
    description:
      "Soma steps through the gate and into a realm where every god keeps score. The second chapter of the Trial.",
    status: "scheduled",
    cover: "/assets/characters/kaira-crop.png",
    pages: pages("cmc_between", 8),
    publishAt: daysFromNow(14, 10),
    reads: 0,
    updatedAt: daysAgo(1, 11),
  },
  {
    id: "cmc_ascension",
    slug: "trial-of-the-gods-ch-3-the-ascension",
    volumeId: "vol_trial",
    chapter: 3,
    title: "The Ascension",
    description: "Working draft. Script locked, pages in progress.",
    status: "draft",
    cover: "/assets/characters/Nze-Ugwuoke.png",
    pages: pages("cmc_ascension", 3),
    reads: 0,
    updatedAt: daysAgo(0, 9),
  },
];

/**
 * The chapters in the store. Chapter 1 sells in print at the public store's
 * ₦10,000 and online (that price is a placeholder); Chapter 2 is set up online
 * and waits in draft for its release. Chapter 3 is not in the store yet.
 */
const COMIC_PRODUCTS: ComicProduct[] = [
  {
    id: "prd_trial",
    slug: "trial-of-the-gods-ch-1-testing-waters",
    type: "comics",
    comicId: "cmc_trial",
    name: "Trial of the Gods Ch. 1: Testing Waters",
    description: COMICS[0].description,
    image: COMICS[0].cover,
    exclusive: false,
    status: "active",
    formats: {
      online: { enabled: true, free: false, price: 3_000, unitsSold: 1_240 },
      physical: { enabled: true, price: 10_000, stock: 64, unitsSold: 386 },
    },
    createdAt: daysAgo(28, 9),
  },
  {
    id: "prd_between",
    slug: "trial-of-the-gods-ch-2-between-worlds",
    type: "comics",
    comicId: "cmc_between",
    name: "Trial of the Gods Ch. 2: Between Worlds",
    description: COMICS[1].description,
    image: COMICS[1].cover,
    exclusive: false,
    status: "draft",
    formats: {
      online: { enabled: true, free: false, price: 5_000, unitsSold: 0 },
      physical: { enabled: false, price: 12_000, stock: 0, unitsSold: 0 },
    },
    createdAt: daysAgo(1, 11),
  },
];

/** Every product, both types. Mutable: the mock adapters write to it. */
export const PRODUCTS: Product[] = [...APPAREL, ...COMIC_PRODUCTS];
