"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/api/auth";
import { failureMessage } from "@/lib/api/client";
import {
  actOnJob,
  approvePayout,
  holdPayout,
  payPayoutManually,
  releasePayout,
  reviewPayoutIdentity,
  saveStoreItem,
  saveTreasurySettings,
  setStoreItemPublished,
} from "@/lib/api/hedera";
import { HEDERA_ON } from "@/lib/hedera/mode";
import { fromLagosInput } from "@/lib/lagos-time";
import {
  holdPayoutSchema,
  manualPayoutSchema,
  rejectIdentitySchema,
  storeItemSchema,
  treasurySettingsSchema,
  type ManualPayoutInput,
  type StoreItemInput,
  type TreasurySettingsInput,
} from "@/lib/schemas";

/**
 * The Hedera screens' writes. Each checks the section is on and an admin is
 * signed in, validates again on the server, and names the admin on the
 * record: every payout needs an approver on file (the doc: "a record for tax").
 */

type Result = { ok: true } | { error: string };

async function who(): Promise<string> {
  if (!HEDERA_ON) throw new Error("The Hedera screens are off.");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin.name;
}

/** Every Hedera page reads the same state, and the layout's badges and notices too. */
function refresh() {
  revalidatePath("/hedera", "layout");
  revalidatePath("/", "layout");
}

async function run(fallback: string, fn: (by: string) => Promise<unknown>): Promise<Result> {
  try {
    await fn(await who());
  } catch (e) {
    return { error: failureMessage(e, fallback) };
  }
  refresh();
  return { ok: true };
}

const id = z.string().min(1).max(120);

/* ---- The game store catalogue ----------------------------------------- */

export async function saveStoreItemAction(assetId: string | null, input: StoreItemInput): Promise<{ error: string } | undefined> {
  const parsed = storeItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  let saved: string;
  try {
    await who();
    const item = await saveStoreItem(assetId, {
      name: v.name,
      description: v.description,
      family: v.family,
      rarity: v.rarity,
      image: v.image,
      imageAlt: v.imageAlt,
      access: v.access,
      price: v.access === "sale" ? { amount: v.priceAmount, currency: v.priceCurrency } : null,
      editionSize: v.limited ? v.editionSize : null,
      saleStartsAt: v.saleStartsAt ? fromLagosInput(v.saleStartsAt) : null,
      saleEndsAt: v.saleEndsAt ? fromLagosInput(v.saleEndsAt) : null,
      published: v.published,
    });
    saved = item.id;
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the item") };
  }
  refresh();
  redirect(`/hedera/store?saved=${encodeURIComponent(saved)}`);
}

export async function setStoreItemPublishedAction(assetId: string, published: boolean): Promise<Result> {
  if (!id.safeParse(assetId).success) return { error: "Unknown item" };
  return run(published ? "Couldn't publish it" : "Couldn't unpublish it", () => setStoreItemPublished(assetId, published));
}

/* ---- Payouts ---------------------------------------------------------- */

export async function verifyIdentityAction(payoutId: string): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  return run("Couldn't verify the identity check", (by) => reviewPayoutIdentity(payoutId, "verified", by));
}

export async function rejectIdentityAction(payoutId: string, note: string): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  const parsed = rejectIdentitySchema.safeParse({ note });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Say what to fix" };
  return run("Couldn't reject the identity check", (by) => reviewPayoutIdentity(payoutId, "rejected", by, parsed.data.note));
}

export async function approvePayoutAction(payoutId: string): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  return run("Couldn't approve the payout", (by) => approvePayout(payoutId, by));
}

export async function holdPayoutAction(payoutId: string, reason: string): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  const parsed = holdPayoutSchema.safeParse({ reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Say why" };
  return run("Couldn't put the payout on hold", (by) => holdPayout(payoutId, parsed.data.reason, by));
}

export async function payPayoutManuallyAction(payoutId: string, input: ManualPayoutInput): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  const parsed = manualPayoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the transfer" };
  return run("Couldn't record the payout", (by) => payPayoutManually(payoutId, parsed.data, by));
}

export async function releasePayoutAction(payoutId: string): Promise<Result> {
  if (!id.safeParse(payoutId).success) return { error: "Unknown payout" };
  return run("Couldn't release the hold", () => releasePayout(payoutId));
}

/* ---- Jobs ------------------------------------------------------------- */

const jobActionName = z.enum(["retry", "recheck", "refund"]);

export async function actOnJobAction(jobId: string, action: z.infer<typeof jobActionName>): Promise<Result> {
  if (!id.safeParse(jobId).success || !jobActionName.safeParse(action).success) return { error: "Unknown job or action" };
  return run("Couldn't start it", (by) => actOnJob(jobId, action, by));
}

/* ---- The treasury ----------------------------------------------------- */

export async function saveTreasurySettingsAction(input: TreasurySettingsInput): Promise<Result> {
  const parsed = treasurySettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the amounts" };
  return run("Couldn't save the settings", () => saveTreasurySettings(parsed.data));
}
