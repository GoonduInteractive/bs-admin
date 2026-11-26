import "server-only";
import { storeItemState } from "@/lib/hedera/catalogue";
import { readyToApprove } from "@/lib/hedera/payouts";
import type {
  HbarRate,
  HederaJob,
  HederaSummary,
  JobAction,
  PrizePayout,
  StoreItem,
  StoreItemDraft,
  TournamentHederaPrize,
  Treasury,
  TreasuryMonth,
  TreasuryMovement,
  TreasurySettings,
} from "@/types/hedera";
import * as mock from "./hedera-mock";
import { MOCK_RATE } from "./hedera-mock-data";

/**
 * The admin's Hedera data: what the doc's "Admin screens (internal)" need from
 * the website backend (catalogue, payout approval) and, through it, the
 * Hedera service (mints, payments, payouts, treasury). NONE OF THESE
 * ENDPOINTS EXISTS YET: every function is served by the in-memory mock
 * (`hedera-mock.ts`) and only runs while the section is on
 * (`lib/hedera/mode.ts`). Each names the call it will become; the paths are
 * placeholders for Tobi to settle, and swapping one in changes this file only.
 */

/* ---- The game store catalogue ----------------------------------------- */

/** GET /v1/admin/hedera/store - every item, published or not (the game backend's catalogue). */
export const getStoreItems = (): Promise<StoreItem[]> => mock.items();

/** GET /v1/admin/hedera/store/{assetId} */
export const getStoreItem = (assetId: string): Promise<StoreItem | null> => mock.item(assetId);

/** POST /v1/admin/hedera/store (new: the backend names the asset ID) or PUT /v1/admin/hedera/store/{assetId}. */
export const saveStoreItem = (assetId: string | null, draft: StoreItemDraft): Promise<StoreItem> => mock.saveItem(assetId, draft);

/** POST /v1/admin/hedera/store/{assetId}/publish | /unpublish */
export const setStoreItemPublished = (assetId: string, published: boolean): Promise<StoreItem> => mock.setPublished(assetId, published);

/** GET /v1/hedera/rate - the gateway's rate, for the HBAR a price comes to. Live, it moves; the checkout quotes for 10 minutes. */
export async function getHbarRate(): Promise<HbarRate> {
  return { ...MOCK_RATE, at: new Date().toISOString() };
}

/** The catalogue's stat cards, from the items and this month's sales on the treasury. */
export async function getStoreStats() {
  const [items, { movements }] = await Promise.all([getStoreItems(), mock.treasury()]);
  const now = Date.now();
  const month = lagosMonth(new Date(now).toISOString());
  const sales = movements.filter((m) => m.kind === "sale" && lagosMonth(m.at) === month);
  const states = items.map((i) => storeItemState(i, now));
  const soon = now + 7 * 86_400_000;
  return {
    live: states.filter((s) => s === "live").length,
    scheduled: states.filter((s) => s === "scheduled").length,
    drafts: states.filter((s) => s === "draft" || s === "unpublished").length,
    soldOut: states.filter((s) => s === "soldOut").length,
    endingSoon: items.filter((i, k) => states[k] === "live" && i.saleEndsAt && Date.parse(i.saleEndsAt) <= soon).length,
    salesThisMonth: sales.length,
    hbarThisMonth: round(sales.reduce((s, m) => s + m.hbar, 0)),
  };
}

/* ---- Prize payouts ------------------------------------------------------ */

/** GET /v1/admin/hedera/payouts - every HBAR prize, from the game backend's confirmed results. */
export const getPayouts = (): Promise<PrizePayout[]> => mock.payouts();

/** POST /v1/admin/hedera/payouts/{id}/identity - { verdict: "verified" | "rejected", note } */
export const reviewPayoutIdentity = (id: string, verdict: "verified" | "rejected", by: string, note?: string): Promise<PrizePayout> =>
  mock.reviewIdentity(id, verdict, by, note);

/** POST /v1/admin/hedera/payouts/{id}/approve - the Hedera service sends the HBAR from the treasury to the linked wallet. */
export const approvePayout = (id: string, by: string): Promise<PrizePayout> => mock.approve(id, by);

/** POST /v1/admin/hedera/payouts/{id}/hold - { reason } */
export const holdPayout = (id: string, reason: string, by: string): Promise<PrizePayout> => mock.hold(id, reason, by);

/**
 * POST /v1/admin/hedera/payouts/{id}/manual - { tx_id, from_account, note }.
 * The fallback when the automated payout can't go: the admin paid it from
 * their own wallet. The backend should check the transfer on the Mirror Node
 * (from, to the winner's wallet, the amount) before it marks the payout sent.
 */
export const payPayoutManually = (id: string, transfer: { txId: string; from: string; note?: string }, by: string): Promise<PrizePayout> =>
  mock.payManually(id, transfer, by);

/** POST /v1/admin/hedera/payouts/{id}/release */
export const releasePayout = (id: string): Promise<PrizePayout> => mock.release(id);

/* ---- Hedera jobs -------------------------------------------------------- */

/** GET /v1/admin/hedera/jobs - failed mints, stuck payments and failed payouts, open and resolved. */
export const getJobs = (): Promise<HederaJob[]> => mock.jobs();

/** POST /v1/admin/hedera/jobs/{id}/{retry|recheck|refund} - with the job's idempotency key, so it never mints or pays twice. */
export const actOnJob = (id: string, action: JobAction, by: string): Promise<HederaJob> => mock.act(id, action, by);

/* ---- The treasury ------------------------------------------------------- */

/** GET /v1/admin/hedera/treasury - the balance from the Mirror Node, and what's committed. */
export async function getTreasury(): Promise<{ treasury: Treasury; movements: TreasuryMovement[]; months: TreasuryMonth[]; thisMonth: TreasuryMonth | null }> {
  const { movements, ...treasury } = await mock.treasury();
  const months = monthsOf(movements);
  const current = lagosMonth(new Date().toISOString());
  return {
    treasury,
    movements: [...movements].sort((a, b) => b.at.localeCompare(a.at)),
    months,
    thisMonth: months.find((m) => m.month === current) ?? null,
  };
}

/** PUT /v1/admin/hedera/treasury/settings - { alert_below, identity_threshold, hbar_discount_pct } */
export const saveTreasurySettings = (settings: TreasurySettings): Promise<void> => mock.saveSettings(settings);

/* ---- Tournament prizes -------------------------------------------------- */

/**
 * A tournament's prize type, HBAR pool and HBAR per place. The tournament
 * endpoints don't carry them yet; they belong on `GET/PUT
 * /v1/admin/tournaments/{id}` as `prize_type`, `hbar_pool` and `hbar_prizes`
 * (the pool divided by the prize split), which the website's tournament pages read too.
 */
export const getTournamentPrize = (tournamentId: string): Promise<TournamentHederaPrize> => mock.tournamentPrize(tournamentId);

export const saveTournamentPrize = (tournamentId: string, prize: TournamentHederaPrize): Promise<void> =>
  mock.saveTournamentPrize(tournamentId, prize);

/** What the tournament form's Hedera fields need: the prize (cash for a new one), the threshold, the free balance. */
export async function getTournamentHederaFields(tournamentId: string | null) {
  const [prize, { treasury }] = await Promise.all([
    tournamentId ? getTournamentPrize(tournamentId) : Promise.resolve<TournamentHederaPrize>({ type: "cash", hbarPool: 0, hbar: [] }),
    getTreasury(),
  ]);
  return { prize, identityThreshold: treasury.identityThreshold, treasuryFree: Math.round((treasury.balance - treasury.committed.sending) * 100) / 100 };
}

/* ---- The layout's badges and notices ------------------------------------ */

export async function getHederaSummary(): Promise<HederaSummary> {
  const [payouts, jobs, { treasury }] = await Promise.all([getPayouts(), getJobs(), getTreasury()]);
  return {
    payoutsReady: payouts.filter((p) => readyToApprove(p, treasury.identityThreshold)).length,
    jobsOpen: jobs.filter((j) => j.status === "open").length,
    balance: treasury.balance,
    alertBelow: treasury.alertBelow,
  };
}

/* ---- Helpers ------------------------------------------------------------ */

const round = (n: number) => Math.round(n * 100) / 100;

/** "2026-11" for an instant, in Lagos (UTC+1, no daylight saving). */
function lagosMonth(at: string): string {
  return new Date(Date.parse(at) + 3_600_000).toISOString().slice(0, 7);
}

/** Money out and in by month, newest first. A top-up is neither spend nor store income. */
function monthsOf(movements: TreasuryMovement[]): TreasuryMonth[] {
  const by = new Map<string, TreasuryMonth>();
  for (const m of movements) {
    const key = lagosMonth(m.at);
    const row = by.get(key) ?? { month: key, payouts: 0, refunds: 0, fees: 0, spent: 0, received: 0 };
    if (m.kind === "payout") row.payouts -= m.hbar;
    if (m.kind === "refund") row.refunds -= m.hbar;
    if (m.kind === "fees") row.fees -= m.hbar;
    if (m.kind === "sale") row.received += m.hbar;
    by.set(key, row);
  }
  return [...by.values()]
    .map((r) => ({ ...r, payouts: round(r.payouts), refunds: round(r.refunds), fees: round(r.fees), received: round(r.received), spent: round(r.payouts + r.refunds + r.fees) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
