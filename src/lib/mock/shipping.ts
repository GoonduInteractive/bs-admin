import { getByState } from "nigeria-lga-data";
import { STATES } from "@/lib/shipping";
import type { FreeShippingPromo, StateShipping } from "@/types";
import { daysAgo } from "./random";

/**
 * SAMPLE PRICES, not Goondu's: every state priced by distance from the Lagos
 * warehouse, by geopolitical zone, with Pickup cheaper than Home Delivery.
 * A few local governments carry their own price to show overrides. Mutable:
 * the mock adapters write to it.
 */
const ZONE_PRICE: Record<string, [homeDelivery: number, pickup: number]> = {
  "South West": [3_000, 2_000],
  "South East": [3_500, 2_500],
  "South South": [3_500, 2_500],
  "North Central": [4_000, 3_000],
  "North West": [5_000, 3_500],
  "North East": [5_500, 4_000],
};

/** Lagos itself is next door; its far edges cost more to reach. */
const OVERRIDES: Record<string, StateShipping["lgas"]> = {
  Lagos: { "lagos-ibeju-lekki": { homeDelivery: 4_000 }, "lagos-epe": { homeDelivery: 4_000, pickup: 2_000 } },
  Enugu: { "enugu-nsukka": { homeDelivery: 4_500 } },
};

export const SHIPPING: StateShipping[] = STATES.map((state) => {
  const [homeDelivery, pickup] = state === "Lagos" ? [2_500, 1_500] : (ZONE_PRICE[getByState(state)[0]?.geopoliticalZone] ?? [4_000, 3_000]);
  return { state, homeDelivery, pickup, lgas: OVERRIDES[state] ?? {}, updatedAt: daysAgo(state === "Lagos" ? 5 : 40) };
});

/** SAMPLE: the promotion is live on orders of ₦30,000 or more, no dates. Mutable. */
export const FREE_SHIPPING: FreeShippingPromo = { enabled: true, minimumOrder: 30_000, updatedAt: daysAgo(2) };
