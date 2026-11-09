import "server-only";
import { z } from "zod";
import type { FreeShippingPromo, ShippingStats, StateShipping } from "@/types";
import { STATES, lgasOf } from "@/lib/shipping";
import { apiFetch, apiFetchAll, fromMinor } from "./client";

/**
 * The store: products and comics (in `products.ts` and `comics.ts`,
 * re-exported here so pages keep one import) and shipping. See each module for
 * what the API can and can't do yet.
 */

export * from "./products";
export * from "./comics";

/* ---- Shipping ---------------------------------------------------------- */
/*
 * The API lists a state's local governments by
 * name, each with the price that applies there; the admin keys them by
 * `nigeria-lga-data` id and keeps only the ones priced on their own. Prices
 * come back in kobo (`*_price_minor`, since 2026-11-04; the free-shipping
 * minimum's `min_order_minor` always did) and go up in naira (`delivery`,
 * `pickup`, `minimum_order`), the same as a product's `price`.
 */

const apiLga = z.object({ lga_name: z.string(), delivery_price_minor: z.coerce.number(), pickup_price_minor: z.coerce.number() });
const apiState = z.object({
  state: z.string(),
  delivery_price_minor: z.coerce.number(),
  pickup_price_minor: z.coerce.number(),
  updated_at: z.string(),
  lgas: z.array(apiLga).default([]),
});

/** "Eti-Osa" and "Eti Osa" are the same place. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function toStateShipping(s: z.output<typeof apiState>): StateShipping {
  const state = STATES.find((n) => squash(n) === squash(s.state)) ?? s.state;
  const ids = new Map(lgasOf(state).map((l) => [squash(l.name), l.id]));
  const lgas: StateShipping["lgas"] = {};
  for (const l of s.lgas) {
    const id = ids.get(squash(l.lga_name));
    if (!id) continue;
    // A local government whose price matches the state's simply follows it.
    const own = {
      ...(l.delivery_price_minor !== s.delivery_price_minor && { homeDelivery: fromMinor(l.delivery_price_minor) }),
      ...(l.pickup_price_minor !== s.pickup_price_minor && { pickup: fromMinor(l.pickup_price_minor) }),
    };
    if (Object.keys(own).length) lgas[id] = own;
  }
  return { state, homeDelivery: fromMinor(s.delivery_price_minor), pickup: fromMinor(s.pickup_price_minor), lgas, updatedAt: s.updated_at };
}

/** Every state's shipping prices, A to Z. */
export async function getShippingRates(): Promise<StateShipping[]> {
  const rates = (await apiFetchAll("/v1/admin/shipping", apiState)).map(toStateShipping);
  return rates.sort((a, b) => a.state.localeCompare(b.state));
}

/*
 * `GET /v1/admin/shipping/stats`. Its price ranges aren't read: they carry no
 * unit, and the prices around them moved to kobo on 2026-11-04. The cards work
 * them out from the states' own prices, so they can't disagree with the table.
 * Its `min_order_minor` isn't read either: the page shows the free-shipping
 * minimum from the promotion itself, the same figure its form edits.
 */
const apiShippingStats = z.object({
  priced_states: z.coerce.number(),
  free_shipping_config: z.object({ status: z.enum(["scheduled", "off", "expired", "on"]) }),
});

const PROMO_PHASE = { on: "live", expired: "ended", scheduled: "scheduled", off: "off" } as const;

/** States priced, the price ranges and where the free shipping promotion stands. */
export async function getShippingStats(): Promise<ShippingStats> {
  const rates = await getShippingRates();
  const span = (prices: number[]) => (prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null);
  const own = (key: "homeDelivery" | "pickup") =>
    rates.flatMap((s) => [s[key], ...Object.values(s.lgas).flatMap((l) => (l[key] == null ? [] : [l[key]]))]);
  const ranges = { homeDelivery: span(own("homeDelivery")), pickup: span(own("pickup")) };
  const s = await apiFetch("/v1/admin/shipping/stats", apiShippingStats);
  return { pricedStates: s.priced_states, ...ranges, promo: PROMO_PHASE[s.free_shipping_config.status] };
}

export async function saveStateShipping(rates: StateShipping): Promise<StateShipping> {
  await apiFetch("/v1/admin/shipping", z.unknown(), {
    method: "PATCH",
    body: {
      state_name: rates.state,
      delivery: rates.homeDelivery,
      pickup: rates.pickup,
      // Every local government with the price that applies there: the API wants at least one,
      // and an explicit price for each leaves the backend nothing to guess about a blank.
      lgas: lgasOf(rates.state).map((l) => ({
        lga_name: l.name,
        delivery: rates.lgas[l.id]?.homeDelivery ?? rates.homeDelivery,
        pickup: rates.lgas[l.id]?.pickup ?? rates.pickup,
      })),
    },
  });
  return rates;
}

/**
 * Never set up, the API has no promotion to return: that reads as switched off.
 * The spec names the end date `ends_at`, but the live reply leaves it out, and
 * the PATCH calls it `end_at`, so either name is read and a missing date is none.
 */
const apiPromo = z
  .object({
    active: z.boolean(),
    min_order_minor: z.coerce.number().nullish(),
    start_at: z.string().nullish(),
    ends_at: z.string().nullish(),
    end_at: z.string().nullish(),
  })
  .nullable();

/** The free shipping promotion. */
export async function getFreeShipping(): Promise<FreeShippingPromo> {
  const p = await apiFetch("/v1/admin/shipping/free-shipping-config", apiPromo);
  if (!p) return { enabled: false, minimumOrder: 0 };
  const endsAt = p.ends_at ?? p.end_at;
  return {
    enabled: p.active,
    minimumOrder: fromMinor(p.min_order_minor ?? 0),
    ...(p.start_at && { startsAt: p.start_at }),
    ...(endsAt && { endsAt }),
  };
}

export async function saveFreeShipping(promo: FreeShippingPromo): Promise<FreeShippingPromo> {
  await apiFetch("/v1/admin/shipping/free-shipping-config", z.unknown(), {
    method: "PATCH",
    body: {
      active: promo.enabled,
      minimum_order: promo.minimumOrder,
      // The API only takes a start date in the future ("Start date must be in the future"). A past one is the
      // running promotion's own, which the form fills back in, so it isn't sent again; the promotion keeps it.
      ...(promo.startsAt && Date.parse(promo.startsAt) > Date.now() && { start_at: promo.startsAt }),
      ...(promo.endsAt && { end_at: promo.endsAt }),
    },
  });
  return promo;
}
