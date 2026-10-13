import { getAll, getByState, type LGA } from "nigeria-lga-data";
import type { DeliveryMethod, FreeShippingPromo, StateShipping } from "@/types";

/**
 * Shipping prices by state and local government. Every state has a Home
 * Delivery and a Pickup price; a local government can override either, and a
 * side it doesn't override uses the state's. Places come from
 * `nigeria-lga-data` - 36 states and the FCT, 774 local governments - so the
 * admin, the checkout and the orders all name them the same way.
 */

/** Nigeria's 36 states and the FCT, A to Z. */
export const STATES: string[] = [...new Set(getAll().map((l) => l.state))].sort((a, b) => a.localeCompare(b));

/** A state's local governments, A to Z. */
export function lgasOf(state: string): LGA[] {
  return getByState(state).sort((a, b) => a.name.localeCompare(b.name));
}

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  homeDelivery: "Home Delivery",
  pickup: "Pickup",
};

/**
 * What shipping costs to a place: the local government's own price if it has
 * one for this method, otherwise the state's. Null when the state has no rates.
 */
export function shippingQuote(
  rates: readonly StateShipping[],
  state: string,
  lgaId: string | undefined,
  method: DeliveryMethod,
): number | null {
  const s = rates.find((r) => r.state === state);
  if (!s) return null;
  return (lgaId ? s.lgas[lgaId]?.[method] : undefined) ?? s[method];
}

/** How many local governments in a state have a price of their own. */
export function overrideCount(s: StateShipping): number {
  return Object.values(s.lgas).filter((o) => o.homeDelivery !== undefined || o.pickup !== undefined).length;
}

/** Where the free shipping promotion stands right now. */
export function promoPhase(p: FreeShippingPromo, now = Date.now()): "off" | "scheduled" | "live" | "ended" {
  if (!p.enabled) return "off";
  if (p.startsAt && now < Date.parse(p.startsAt)) return "scheduled";
  if (p.endsAt && now >= Date.parse(p.endsAt)) return "ended";
  return "live";
}

/** Whether an order with this items total ships free under the promotion. */
export function shipsFree(p: FreeShippingPromo, itemsTotal: number, now = Date.now()): boolean {
  return promoPhase(p, now) === "live" && itemsTotal >= p.minimumOrder;
}
