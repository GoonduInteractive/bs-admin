"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  advanceStage,
  disqualify,
  getTournament,
  getRegions,
  getTournaments,
  recordResult,
  saveTournament,
  setTournamentStatus,
} from "@/lib/api/competition";
import { fromLagosInput } from "@/lib/lagos-time";
import { tournamentSchema, type TournamentInput } from "@/lib/schemas";
import { GLOBAL_REGION } from "@/lib/regions";
import { newStages } from "@/lib/tournaments";
import type { Tournament } from "@/types";


function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function refresh(slug?: string) {
  revalidatePath("/tournaments");
  if (slug) revalidatePath(`/tournaments/${slug}`);
  revalidatePath("/");
}

const at = (v?: string) => (v ? fromLagosInput(v) : undefined);

export async function saveTournamentAction(slug: string | null, input: TournamentInput) {
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;

  const existing = slug ? await getTournament(slug) : null;
  const all = await getTournaments();
  const newSlug = existing?.slug ?? slugify(v.name);
  if (!existing && all.some((t) => t.slug === newSlug)) {
    return { error: "A tournament with that name already exists" };
  }
  // From the Regions list: an active region, Global, or the archived one it already had.
  if (v.region !== GLOBAL_REGION && v.region !== existing?.region) {
    const region = (await getRegions()).find((r) => r.id === v.region);
    if (!region) return { error: "That region no longer exists" };
    if (region.status !== "active") return { error: `${region.name} is archived. Restore it in Regions, or pick another.` };
  }
  if (existing && !v.unlimitedSlots && v.slots < existing.slots.taken) {
    return { error: `${existing.slots.taken} players are already registered; slots can't go below that` };
  }

  const tournament: Tournament = {
    id: existing?.id ?? `trn_${crypto.randomUUID().slice(0, 8)}`,
    slug: newSlug,
    name: v.name,
    description: v.description,
    // Editing never moves a running tournament backwards; its lifecycle has its own controls.
    status: existing && !["draft", "comingSoon", "registrationOpen"].includes(existing.status) ? existing.status : v.status,
    region: v.region,
    format: "oneVone",
    startsAt: at(v.startsAt),
    endsAt: at(v.endsAt),
    registrationClosesAt: at(v.registrationClosesAt),
    prizePool: v.prizePool,
    prizeSplit: v.prizeSplit.map((p) => p.share),
    slots: { taken: existing?.slots.taken ?? 0, total: v.unlimitedSlots ? null : v.slots },
    inGameRewards: v.inGameRewards,
    stages:
      existing?.stages ??
      newStages().map((s) => (s.key === "registration" && v.status === "registrationOpen" ? { ...s, status: "inProgress" } : s)),
    bracket: existing?.bracket ?? [],
    participants: existing?.participants ?? [],
    featured: v.featured,
  };

  // Only one tournament leads the Competition page at a time.
  if (tournament.featured) {
    for (const t of await getTournaments()) if (t.featured && t.id !== tournament.id) await saveTournament({ ...t, featured: false });
  }

  await saveTournament(tournament);
  refresh(tournament.slug);
  redirect(`/tournaments/${tournament.slug}`);
}

const status = z.enum(["draft", "comingSoon", "registrationOpen", "active", "completed", "cancelled"]);

export async function setStatusAction(slug: string, next: z.infer<typeof status>) {
  const parsed = status.safeParse(next);
  if (!parsed.success) return { error: "Unknown status" };
  const t = await setTournamentStatus(slug, parsed.data);
  if (parsed.data === "registrationOpen" && t.stages[0].status === "upcoming") t.stages[0].status = "inProgress";
  refresh(slug);
  return { ok: true as const };
}

const schedule = z
  .object({
    /** Lagos-time `datetime-local` values from the advance prompt. */
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .optional();

/**
 * The admin moves the tournament on, one stage at a time, and says when the
 * next stage starts so players get notice. Completing the Final needs no date.
 */
export async function advanceStageAction(slug: string, when?: z.infer<typeof schedule>) {
  const parsed = schedule.safeParse(when);
  if (!parsed.success) return { error: "Check the dates" };
  const startsAt = parsed.data?.startsAt ? fromLagosInput(parsed.data.startsAt) : undefined;
  const endsAt = parsed.data?.endsAt ? fromLagosInput(parsed.data.endsAt) : undefined;
  if (startsAt && new Date(startsAt).getTime() < Date.now()) return { error: "Pick a start time in the future, so players get notice" };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "The qualifier window must close after it opens" };
  try {
    await advanceStage(slug, startsAt ? { startsAt, endsAt } : undefined);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not move to the next stage" };
  }
  refresh(slug);
  return { ok: true as const };
}

export async function recordResultAction(slug: string, matchId: string, winner: 0 | 1) {
  try {
    await recordResult(slug, matchId, winner);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the result" };
  }
  refresh(slug);
  return { ok: true as const };
}

/**
 * `typedHandle` is what the admin typed in the confirm dialog. It's checked
 * here too, so nothing but a deliberate, handle-typed confirmation disqualifies.
 */
export async function disqualifyAction(slug: string, playerId: string, typedHandle: string) {
  const t = await getTournament(slug);
  const p = t.participants.find((x) => x.playerId === playerId);
  if (!p) return { error: "That player isn't in this tournament" };
  if (p.status === "eliminated" || p.status === "champion") return { error: `@${p.handle} is already out of the tournament` };
  if (typedHandle.trim() !== p.handle) return { error: `Type @${p.handle}'s handle exactly to disqualify them` };
  await disqualify(slug, playerId);
  refresh(slug);
  return { ok: true as const };
}
