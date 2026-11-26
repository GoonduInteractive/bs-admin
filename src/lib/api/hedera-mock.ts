import "server-only";
import { assetIdFor } from "@/lib/hedera/catalogue";
import { approvalBlocker, jobActions, refundAmount } from "@/lib/hedera/payouts";
import type {
  HederaJob,
  JobAction,
  PrizePayout,
  StoreItem,
  StoreItemDraft,
  TournamentHederaPrize,
  TreasuryMovement,
  TreasurySettings,
} from "@/types/hedera";
import { GAME, MOCK_COLLECTIONS, MOCK_TREASURY, seed, txIdAt, type MockState } from "./hedera-mock-data";

/**
 * A stand-in for the Hedera service and the website backend's Hedera admin
 * routes: one state in this server's memory, shared by every page and action.
 * It starts from `hedera-mock-data.ts` and RESETS WHEN THE SERVER RESTARTS.
 *
 * Time moves things on, the way the real service would: an approved payout is
 * "sending" for a few seconds, then sent, with a transaction ID and the HBAR
 * off the treasury; a retried or refunded job is "working", then resolved.
 * Each read settles whatever is due first.
 *
 * Rule breaks throw an `Error` whose message is the admin's to read, as the
 * API's refusals do (`failureMessage` passes it through).
 */

/** How long a payout takes to land, and a retry or refund to finish. */
const SEND_MS = 6_000;
const WORK_MS = 5_000;

/** About $0.02 per mint, in HBAR. A transfer costs a fraction of a cent and is left out. */
const MINT_FEE = 0.11;

// On globalThis so the pages, the actions and a dev server's reloads share one state.
const holder = globalThis as typeof globalThis & { __bsHederaMock?: MockState };

function db(): MockState {
  const s = (holder.__bsHederaMock ??= seed(Date.now()));
  settle(s, Date.now());
  return s;
}

const iso = (ms: number) => new Date(ms).toISOString();
const clone = <T>(v: T): T => structuredClone(v);

function tx(s: MockState, payer: string, at: number) {
  return txIdAt(payer, at, ++s.seq);
}

function move(s: MockState, kind: TreasuryMovement["kind"], hbar: number, label: string, at: number, txId: string | null) {
  s.movements.push({ id: `mv-${++s.seq}`, kind, hbar: Math.round(hbar * 100_000_000) / 100_000_000, label, at: iso(at), txId });
}

function balanceOf(s: MockState) {
  return Math.round(s.movements.reduce((sum, m) => sum + m.hbar, 0) * 100) / 100;
}

/** Payouts on their way: approved, not yet on the network. */
function sendingTotal(s: MockState) {
  return s.payouts.filter((p) => p.status === "sending").reduce((sum, p) => sum + p.hbar, 0);
}

/* ---- Time ------------------------------------------------------------- */

function settle(s: MockState, now: number) {
  for (const p of s.payouts) {
    if (p.status !== "sending" || !p.approvedAt) continue;
    // A failed payout being retried lands when its job finishes, not from its first approval.
    if (s.jobs.some((j) => j.status === "working" && j.reference === p.id)) continue;
    const due = Date.parse(p.approvedAt) + SEND_MS;
    if (now < due) continue;
    landPayout(s, p, due);
  }
  for (const j of s.jobs) {
    if (j.status !== "working" || !j.working) continue;
    const due = Date.parse(j.working.since) + WORK_MS;
    if (now < due) continue;
    finishJob(s, j, due);
  }
}

function landPayout(s: MockState, p: PrizePayout, at: number) {
  if (p.status === "sent") return;
  p.status = "sent";
  p.txId = tx(s, MOCK_TREASURY, at);
  p.sentAt = iso(at);
  p.updatedAt = iso(at);
  delete p.failure;
  move(s, "payout", -p.hbar, `Prize: ${p.tournament.name}, ${place(p.place)} place, @${p.player.handle}`, at, p.txId);
}

function finishJob(s: MockState, j: HederaJob, at: number) {
  const action = j.working!.action;
  let txId: string | null = null;
  if (action === "refund") {
    txId = tx(s, MOCK_TREASURY, at);
    move(s, "refund", -refundAmount(j), `Refund: ${j.reference}, ${j.item}`, at, txId);
  } else if (action === "recheck") {
    // The gateway's confirmation was missing; the Mirror Node has the payment, so the order goes on to its mint.
    txId = j.txId;
  } else if (j.kind === "payout") {
    const p = s.payouts.find((x) => x.id === j.reference);
    if (p) {
      landPayout(s, p, at);
      txId = p.txId;
    }
  } else {
    txId = tx(s, MOCK_TREASURY, at);
    move(s, "fees", -MINT_FEE, `Network fee: mint for ${j.reference}`, at, null);
  }
  j.status = "resolved";
  j.attempts += action === "retry" ? 1 : 0;
  j.resolution = { action, by: j.working!.by, at: iso(at), txId };
  j.updatedAt = iso(at);
  delete j.working;
}

const place = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

/* ---- The catalogue ---------------------------------------------------- */

export async function items(): Promise<StoreItem[]> {
  return clone(db().items);
}

export async function item(id: string): Promise<StoreItem | null> {
  const found = db().items.find((i) => i.id === id);
  return found ? clone(found) : null;
}

export async function saveItem(id: string | null, draft: StoreItemDraft): Promise<StoreItem> {
  const s = db();
  const now = Date.now();
  const existing = id ? s.items.find((i) => i.id === id) : undefined;
  if (id && !existing) throw new Error("That item is no longer in the catalogue.");

  if (existing) {
    if (draft.editionSize !== null && draft.editionSize < existing.sold) {
      throw new Error(`${existing.sold.toLocaleString("en-NG")} have already gone to players, so the edition can't be smaller than that.`);
    }
    Object.assign(existing, {
      name: draft.name,
      description: draft.description,
      rarity: draft.rarity,
      image: draft.image,
      imageAlt: draft.imageAlt,
      access: draft.access,
      price: draft.price,
      supply: draft.editionSize === null ? null : { total: draft.editionSize, remaining: draft.editionSize - existing.sold },
      saleStartsAt: draft.saleStartsAt,
      saleEndsAt: draft.saleEndsAt,
      published: draft.published,
      publishedAt: existing.publishedAt ?? (draft.published ? iso(now) : null),
      updatedAt: iso(now),
    } satisfies Partial<StoreItem>);
    return clone(existing);
  }

  const newId = assetIdFor(draft.family, draft.name);
  if (s.items.some((i) => i.id === newId)) throw new Error(`There's already an item with the asset ID ${newId}. Give this one another name.`);
  const created: StoreItem = {
    id: newId,
    name: draft.name,
    description: draft.description,
    family: draft.family,
    rarity: draft.rarity,
    image: draft.image,
    imageAlt: draft.imageAlt,
    games: [GAME],
    access: draft.access,
    price: draft.price,
    supply: draft.editionSize === null ? null : { total: draft.editionSize, remaining: draft.editionSize },
    saleEndsAt: draft.saleEndsAt,
    tokenId: MOCK_COLLECTIONS[draft.family],
    saleStartsAt: draft.saleStartsAt,
    published: draft.published,
    publishedAt: draft.published ? iso(now) : null,
    sold: 0,
    createdAt: iso(now),
    updatedAt: iso(now),
  };
  s.items.push(created);
  return clone(created);
}

export async function setPublished(id: string, published: boolean): Promise<StoreItem> {
  const s = db();
  const it = s.items.find((i) => i.id === id);
  if (!it) throw new Error("That item is no longer in the catalogue.");
  if (published && !it.image) throw new Error(`${it.name} has no picture. Add one before it goes on the store.`);
  it.published = published;
  if (published && !it.publishedAt) it.publishedAt = new Date().toISOString();
  it.updatedAt = new Date().toISOString();
  return clone(it);
}

/* ---- Payouts ---------------------------------------------------------- */

export async function payouts(): Promise<PrizePayout[]> {
  return clone(db().payouts);
}

function findPayout(s: MockState, id: string) {
  const p = s.payouts.find((x) => x.id === id);
  if (!p) throw new Error("That payout is no longer listed.");
  return p;
}

export async function reviewIdentity(id: string, verdict: "verified" | "rejected", by: string, note?: string): Promise<PrizePayout> {
  const s = db();
  const p = findPayout(s, id);
  if (p.identity.state !== "submitted") throw new Error("There's no identity check waiting for review on this payout.");
  const now = new Date().toISOString();
  p.identity = { ...p.identity, state: verdict, reviewedBy: by, reviewedAt: now, ...(verdict === "rejected" ? { note } : { note: undefined }) };
  p.updatedAt = now;
  return clone(p);
}

export async function approve(id: string, by: string): Promise<PrizePayout> {
  const s = db();
  const p = findPayout(s, id);
  if (p.status !== "awaitingApproval") throw new Error("This payout isn't waiting for approval.");
  const blocker = approvalBlocker(p, s.treasury.identityThreshold);
  if (blocker) throw new Error(blocker);
  const free = balanceOf(s) - sendingTotal(s);
  if (free < p.hbar) {
    throw new Error(`The treasury has ${free.toLocaleString("en-NG", { maximumFractionDigits: 2 })} HBAR free, not enough for ${p.hbar.toLocaleString("en-NG")} HBAR. Top it up first.`);
  }
  const now = new Date().toISOString();
  Object.assign(p, { status: "sending", approvedBy: by, approvedAt: now, updatedAt: now } satisfies Partial<PrizePayout>);
  return clone(p);
}

export async function hold(id: string, reason: string, by: string): Promise<PrizePayout> {
  const s = db();
  const p = findPayout(s, id);
  if (p.status !== "awaitingApproval") throw new Error("Only a payout waiting for approval can be put on hold.");
  const now = new Date().toISOString();
  Object.assign(p, { status: "held", hold: { reason, by, at: now }, updatedAt: now } satisfies Partial<PrizePayout>);
  return clone(p);
}

/**
 * The fallback when the automated payout can't go (the team, 2026-11-23): an
 * admin sent the HBAR from their own wallet, and records the transfer here.
 * Only for a payout that failed, or one cleared to approve, and only to the
 * winner's verified wallet. The treasury didn't pay, so no movement is added;
 * a failed payout's open job closes with it.
 */
export async function payManually(id: string, transfer: { txId: string; from: string; note?: string }, by: string): Promise<PrizePayout> {
  const s = db();
  const p = findPayout(s, id);
  if (p.status !== "failed" && p.status !== "awaitingApproval") throw new Error("Only a failed payout, or one waiting for approval, can be marked as paid by hand.");
  const blocker = approvalBlocker(p, s.treasury.identityThreshold);
  if (blocker) throw new Error(blocker);
  if (s.payouts.some((x) => x.txId === transfer.txId) || s.movements.some((m) => m.txId === transfer.txId)) {
    throw new Error("That transaction is already on record for another payment.");
  }
  const now = new Date().toISOString();
  Object.assign(p, {
    status: "sent",
    txId: transfer.txId,
    sentAt: now,
    updatedAt: now,
    approvedBy: p.approvedBy ?? by,
    approvedAt: p.approvedAt ?? now,
    manual: { by, at: now, from: transfer.from, ...(transfer.note ? { note: transfer.note } : {}) },
  } satisfies Partial<PrizePayout>);
  delete p.failure;
  for (const j of s.jobs) {
    if (j.kind !== "payout" || j.reference !== p.id || j.status === "resolved") continue;
    Object.assign(j, { status: "resolved", resolution: { action: "paidManually", by, at: now, txId: transfer.txId }, updatedAt: now } satisfies Partial<HederaJob>);
    delete j.working;
  }
  return clone(p);
}

export async function release(id: string): Promise<PrizePayout> {
  const s = db();
  const p = findPayout(s, id);
  if (p.status !== "held") throw new Error("This payout isn't on hold.");
  p.status = "awaitingApproval";
  delete p.hold;
  p.updatedAt = new Date().toISOString();
  return clone(p);
}

/* ---- Jobs ------------------------------------------------------------- */

export async function jobs(): Promise<HederaJob[]> {
  return clone(db().jobs);
}

export async function act(id: string, action: JobAction, by: string): Promise<HederaJob> {
  const s = db();
  const j = s.jobs.find((x) => x.id === id);
  if (!j) throw new Error("That job is no longer listed.");
  if (j.status === "working") throw new Error("Someone is already on it. Give it a few seconds.");
  if (j.status === "resolved") throw new Error("This one's already resolved.");
  if (!jobActions(j).includes(action)) throw new Error("That isn't something this job can do.");
  if (action === "refund" && balanceOf(s) - sendingTotal(s) < refundAmount(j)) throw new Error("The treasury doesn't have enough free HBAR for this refund. Top it up first.");
  if (j.kind === "payout") {
    const p = s.payouts.find((x) => x.id === j.reference);
    if (p) {
      p.status = "sending";
      p.updatedAt = new Date().toISOString();
    }
  }
  j.status = "working";
  j.working = { action, by, since: new Date().toISOString() };
  j.updatedAt = j.working.since;
  return clone(j);
}

/* ---- The treasury ----------------------------------------------------- */

export async function treasury() {
  const s = db();
  const awaiting = s.payouts.filter((p) => p.status === "awaitingApproval").reduce((sum, p) => sum + p.hbar, 0);
  return {
    ...clone(s.treasury),
    balance: balanceOf(s),
    committed: { sending: sendingTotal(s), awaitingApproval: awaiting },
    movements: clone(s.movements),
  };
}

export async function saveSettings(settings: TreasurySettings): Promise<void> {
  const s = db();
  Object.assign(s.treasury, settings, { updatedAt: new Date().toISOString() });
}

/* ---- Tournament prizes ------------------------------------------------ */

export async function tournamentPrize(tournamentId: string): Promise<TournamentHederaPrize> {
  return clone(db().prizes[tournamentId] ?? CASH_ONLY);
}

export async function saveTournamentPrize(tournamentId: string, prize: TournamentHederaPrize): Promise<void> {
  db().prizes[tournamentId] = clone(prize.type === "cash" ? CASH_ONLY : prize);
}

const CASH_ONLY: TournamentHederaPrize = { type: "cash", hbarPool: 0, hbar: [] };
