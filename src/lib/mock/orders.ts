import type { Order, OrderLine, OrderStatus, PaymentMethod, ProductSize, ApparelProduct, ComicProduct } from "@/types";
import { variantPrice } from "@/lib/pricing";
import { lgasOf, shippingQuote } from "@/lib/shipping";
import { PRODUCTS } from "./catalogue";
import { PLAYERS } from "./players";
import { SHIPPING as SHIPPING_RATES } from "./shipping";
import { DAY, createRandom, daysAgo } from "./random";

/**
 * Orders across the last ninety days. Older orders are mostly delivered;
 * the last few days hold the pending and in-transit ones, which is what a
 * real queue looks like.
 */

const rand = createRandom(42);

/** City, its real local government (as `nigeria-lga-data` names it) and state. */
const CITIES: readonly [city: string, lga: string, state: string][] = [
  ["Ikeja", "Ikeja", "Lagos"],
  ["Lekki", "Eti-Osa", "Lagos"],
  ["Yaba", "Lagos Mainland", "Lagos"],
  ["Enugu", "Enugu North", "Enugu"],
  ["Awka", "Awka South", "Anambra"],
  ["Owerri", "Owerri Municipal", "Imo"],
  ["Port Harcourt", "Port Harcourt", "Rivers"],
  ["Wuse", "Municipal Area Council", "Federal Capital Territory"],
  ["Ibadan", "Ibadan North", "Oyo"],
];

const STREETS = ["Allen Avenue", "Admiralty Way", "Herbert Macaulay Way", "Ogui Road", "Zik Avenue", "Aminu Kano Crescent", "Aba Road"];


function statusFor(ageDays: number): OrderStatus {
  if (ageDays <= 1) return rand.weighted([["pending", 6], ["processing", 3], ["cancelled", 1]]);
  if (ageDays <= 5) return rand.weighted([["processing", 3], ["inTransit", 6], ["cancelled", 1]]);
  return rand.weighted([["delivered", 12], ["cancelled", 1]]);
}

const FLOW: OrderStatus[] = ["pending", "processing", "inTransit", "delivered"];

/** A digital order (online comics only) goes straight from paid to delivered. */
function timeline(status: OrderStatus, placedAt: string, digital = false) {
  const start = new Date(placedAt).getTime();
  const steps: OrderStatus[] =
    status === "cancelled"
      ? ["pending", "cancelled"]
      : digital
        ? ["pending", "delivered"]
        : FLOW.slice(0, FLOW.indexOf(status) + 1);
  // Shipped orders move a step every day or so; a digital one is delivered a minute after payment.
  const gap = digital ? 60_000 : DAY * 1.3;
  return steps.map((s, i) => ({ status: s, at: new Date(start + i * gap).toISOString() }));
}

function randomLine(): OrderLine {
  if (rand.next() < 0.22) {
    // Vol. 1 is the comic on sale. Online outsells print, as its unit counts say.
    const comic = PRODUCTS.find((p): p is ComicProduct => p.type === "comics" && p.status === "active")!;
    const format = rand.weighted([["online", 3], ["physical", 1]] as const);
    return {
      kind: "comic",
      refId: comic.id,
      name: comic.name,
      image: comic.image,
      format,
      quantity: 1,
      unitPrice: comic.formats[format].price,
    };
  }
  const apparel = PRODUCTS.filter((p): p is ApparelProduct => p.type === "apparel");
  const product = rand.weighted(apparel.map((p) => [p, p.unitsSold] as const));
  const colour = rand.pick(product.colours);
  const size = rand.pick(product.sizes) as ProductSize;
  return {
    kind: "product",
    refId: product.id,
    name: product.name,
    image: product.image,
    colour: colour.name,
    size,
    quantity: rand.weighted([[1, 8], [2, 2], [3, 1]]),
    unitPrice: variantPrice(product, colour.id, size),
  };
}

const ORDER_COUNT = 96;

export const ORDERS: Order[] = Array.from({ length: ORDER_COUNT }, (_, i) => {
  // Spread newest-first across ninety days, denser towards today.
  const ageDays = Math.floor(Math.pow(i / ORDER_COUNT, 1.4) * 90);
  const placedAt = daysAgo(ageDays, rand.int(8, 22), rand.int(0, 59));
  const player = rand.pick(PLAYERS);
  const lines = Array.from({ length: rand.weighted([[1, 6], [2, 3], [3, 1]]) }, randomLine);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  // Apparel and print comics ship; an order of online comics alone does not.
  const physical = lines.some((l) => l.kind === "product" || l.format === "physical");
  const pointsDiscount = rand.next() < 0.18 ? 1_000 * rand.int(1, 3) : 0;
  // Nothing to ship means nothing to process or send: the reader unlocks on
  // payment, so a digital order is delivered unless it was cancelled.
  const drawn = statusFor(ageDays);
  const status: OrderStatus = physical || drawn === "cancelled" ? drawn : "delivered";
  const method: PaymentMethod = rand.weighted([["bankTransfer", 3], ["card", 2]]);
  const [city, lga, state] = rand.pick(CITIES);
  // About one shipped order in four is a Pickup: only the state and local government travel with it.
  // Decided by position, not drawn, so the seeded sequence below stays stable.
  const pickup = i % 4 === 1;
  // Drawn for every order so the seeded sequence stays stable; dropped when there is nothing to ship.
  const street = `${rand.int(2, 88)} ${rand.pick(STREETS)}`;
  const address = {
    ...(pickup ? {} : { line1: street, city }),
    lga,
    state,
    country: "Nigeria",
    phone: `+234 80${rand.int(1, 9)} ${rand.int(100, 999)} ${rand.int(1000, 9999)}`,
  };
  // Sample orders predate any promotion: each pays its place's price, from the Shipping page's rates -
  // the local government's own if it has one, otherwise the state's.
  const lgaId = lgasOf(state).find((l) => l.name === lga)?.id;
  const shipping = physical ? (shippingQuote(SHIPPING_RATES, state, lgaId, pickup ? "pickup" : "homeDelivery") ?? 0) : 0;

  return {
    id: `ord_${String(ORDER_COUNT - i).padStart(5, "0")}`,
    reference: `BS-${String(1000 + ORDER_COUNT - i)}`,
    customer: { id: player.id, name: player.name, email: player.email, handle: player.handle },
    lines,
    subtotal,
    pointsDiscount,
    shipping,
    total: subtotal - pointsDiscount + shipping,
    status,
    paymentMethod: method,
    deliveryMethod: physical ? (pickup ? "pickup" : "homeDelivery") : undefined,
    shippingAddress: physical ? address : undefined,
    placedAt,
    timeline: timeline(status, placedAt, !physical),
  };
});
