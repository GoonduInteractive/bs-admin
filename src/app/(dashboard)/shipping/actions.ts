"use server";

import { revalidatePath } from "next/cache";
import { getShippingRates, saveFreeShipping, saveStateShipping } from "@/lib/api/merch";
import { fromLagosInput } from "@/lib/lagos-time";
import { STATES, lgasOf } from "@/lib/shipping";
import { freeShippingSchema, stateShippingSchema, type FreeShippingInput, type StateShippingInput } from "@/lib/schemas";
import type { LgaShipping } from "@/types";

/**
 * Save one state's prices. Only overrides that differ from blank are kept, and
 * only for that state's own local governments, so the record stays small and
 * every blank goes on following the state's price.
 */
export async function saveStateShippingAction(state: string, input: StateShippingInput) {
  if (!STATES.includes(state)) return { error: "Unknown state" };
  const parsed = stateShippingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the prices" };
  const v = parsed.data;

  const own = new Set(lgasOf(state).map((l) => l.id));
  const lgas: Record<string, LgaShipping> = {};
  for (const [id, o] of Object.entries(v.lgas)) {
    if (!own.has(id) || (!o.homeDelivery && !o.pickup)) continue;
    lgas[id] = {
      ...(o.homeDelivery && { homeDelivery: Number(o.homeDelivery) }),
      ...(o.pickup && { pickup: Number(o.pickup) }),
    };
  }

  const existing = (await getShippingRates()).find((s) => s.state === state);
  await saveStateShipping({ ...existing, state, homeDelivery: v.homeDelivery, pickup: v.pickup, lgas, updatedAt: new Date().toISOString() });
  revalidatePath("/shipping");
  return { ok: true as const };
}

/** Save the free shipping promotion. */
export async function saveFreeShippingAction(input: FreeShippingInput) {
  const parsed = freeShippingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the promotion" };
  const v = parsed.data;
  await saveFreeShipping({
    enabled: v.enabled,
    minimumOrder: Number(v.minimumOrder),
    ...(v.startsAt && { startsAt: fromLagosInput(v.startsAt) }),
    ...(v.endsAt && { endsAt: fromLagosInput(v.endsAt) }),
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/shipping");
  return { ok: true as const };
}
