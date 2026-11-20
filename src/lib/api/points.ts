import "server-only";
import { z } from "zod";
import type { SeedsEntry, SeedsLedger } from "@/types";
import { apiFetch } from "./client";

/**
 * A player's Seeds, the community points earned reading comics, sharing them,
 * bringing friends and playing, and spent on store discounts.
 *
 *   GET  /v1/admin/points/{player_id}  getSeedsLedger(): the balances and the latest entries
 *   POST /v1/admin/points/reverse      reverseSeedsEntry(): claw an entry back, with a reason
 *
 * The entries' `kind`, `source` and `status` values aren't listed in the spec,
 * so they're shown as the API words them. FLAGGED: ask for the lists.
 */

/** How many entries the panel shows. */
const LATEST = 50;

const apiEntry = z.object({
  id: z.string(),
  amount: z.coerce.number(),
  direction: z.string(),
  kind: z.string().nullish(),
  source: z.string().nullish(),
  status: z.string().nullish(),
  available_at: z.string().nullish(),
  reference_id: z.string().nullish(),
  created_at: z.string(),
});

const apiLedger = z.object({
  balances: z.object({
    calabash: z.coerce.number().default(0),
    legacy: z.coerce.number().default(0),
    pending: z.coerce.number().default(0),
  }),
  entries: z.array(apiEntry).default([]),
});

function toEntry(e: z.output<typeof apiEntry>): SeedsEntry {
  return {
    id: e.id,
    amount: Math.abs(e.amount),
    direction: e.direction.toLowerCase() === "debit" ? "debit" : "credit",
    kind: e.kind ?? "",
    source: e.source ?? "",
    status: e.status ?? "",
    ...(e.available_at && { availableAt: e.available_at }),
    ...(e.reference_id && { reference: e.reference_id }),
    createdAt: e.created_at,
  };
}

export async function getSeedsLedger(playerId: string): Promise<SeedsLedger> {
  const l = await apiFetch(`/v1/admin/points/${encodeURIComponent(playerId)}`, apiLedger, { query: { limit: LATEST } });
  return {
    ...l.balances,
    entries: l.entries.map(toEntry).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** Takes an entry's Seeds back. Returns how many were taken. */
export async function reverseSeedsEntry(entryId: string, reason: string): Promise<number> {
  const reply = await apiFetch("/v1/admin/points/reverse", z.object({ reversed_amount: z.coerce.number() }), {
    method: "POST",
    body: { entry_id: entryId, ...(reason && { reason }) },
  });
  return Math.abs(reply.reversed_amount);
}
