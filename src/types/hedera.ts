/**
 * The admin's Hedera contracts, after Sophia's "Hedera on the Website (v2
 * Scope)" (2026-11-09), "Admin screens (internal)": the game store catalogue,
 * payout approvals, Hedera jobs and the treasury, plus the prize type on the
 * tournament form.
 *
 * NONE OF THE ENDPOINTS EXISTS YET. The admin runs these screens on the mock
 * in `lib/api/hedera-mock.ts`, behind `HEDERA_MOCK=1` (`lib/hedera/mode.ts`).
 * The shapes follow the website's (`beyond-service-hedera`,
 * `src/types/hedera.ts`) wherever both sides see the same thing, so one
 * backend reply can serve both: a published `StoreItem` is the website's
 * `HederaAsset`, a `PrizePayout` is the website's `HederaPrize` seen from the
 * admin's side, and `TournamentPrizeType` is the same three words.
 *
 * Who owns what (the doc): the catalogue is the game backend's, the wallet
 * link the website backend's, mints, payments, payouts and the treasury the
 * Hedera service's. The admin only reads the last three and asks for actions.
 */

export type HederaNetwork = "testnet" | "mainnet";

/* ---- The game store catalogue ----------------------------------------- */

export type AssetFamily = "skin" | "weapon" | "character";
export type AssetRarity = "common" | "rare" | "epic" | "legendary";

export const ASSET_FAMILIES: readonly AssetFamily[] = ["skin", "weapon", "character"];
export const ASSET_RARITIES: readonly AssetRarity[] = ["common", "rare", "epic", "legendary"];

/** A price as the game store sets it: naira or US dollars. HBAR is only ever a quote of it. */
export type FiatPrice = { amount: number; currency: "NGN" | "USD" };
export const PRICE_CURRENCIES: readonly FiatPrice["currency"][] = ["NGN", "USD"];

/**
 * One Hedera exclusive in the game store's catalogue. Everything up to
 * `tokenId` is the website's `HederaAsset`, field for field; the rest is the
 * admin's. The website only ever sees an item that is published and inside
 * its sale window (the backend filters).
 */
export type StoreItem = {
  /** The asset ID. Stable across Goondu games, so it never changes once created. */
  id: string;
  name: string;
  description: string;
  family: AssetFamily;
  rarity: AssetRarity;
  /** The art, as uploaded. Empty when the mock has none to show. */
  image: string;
  imageAlt: string;
  /** The Goondu games that recognise it. */
  games: string[];
  /** Sold in the game store, or free to every player who links a wallet. */
  access: "sale" | "free";
  /** Null for a free exclusive. */
  price: FiatPrice | null;
  /** A limited edition's size and what's left; null when unlimited. */
  supply: { total: number; remaining: number } | null;
  /** ISO instant the sale (or the claim, for a free one) ends; null when it doesn't. */
  saleEndsAt: string | null;
  /** Its HTS collection: one per family. */
  tokenId: string;

  /** ISO instant the sale opens; null when it opens on publishing. Not on the website's type (the backend filters). */
  saleStartsAt: string | null;
  /** On the store, or not: a draft and an unpublished item are both off it. */
  published: boolean;
  /** Set the first time it's published. Null: a draft that has never been on the store. */
  publishedAt: string | null;
  /** Bought (for sale) or claimed (free), all time. */
  sold: number;
  createdAt: string;
  updatedAt: string;
};

/** Where an item stands on the store right now, worked out from the item and the time. */
export type StoreItemState = "draft" | "scheduled" | "live" | "soldOut" | "ended" | "unpublished";

/** What the admin sends to add an item or change one. The asset ID and collection come from the name and family. */
export type StoreItemDraft = Pick<
  StoreItem,
  "name" | "description" | "family" | "rarity" | "image" | "imageAlt" | "access" | "price" | "saleStartsAt" | "saleEndsAt" | "published"
> & {
  /** Null: unlimited. */
  editionSize: number | null;
};

/** The gateway's rate, for the catalogue's HBAR estimates: naira or dollars per HBAR. */
export type HbarRate = { NGN: number; USD: number; at: string };

/* ---- Prize payouts ------------------------------------------------------ */

/** How a tournament pays, set per tournament by an admin. The website reads the same three words. */
export type TournamentPrizeType = "cash" | "hbar" | "both";
export const TOURNAMENT_PRIZE_TYPES: readonly TournamentPrizeType[] = ["cash", "hbar", "both"];

/**
 * A tournament's HBAR prize. The admin sets a pool, and the tournament's prize
 * split (the same shares as the cash pool) divides it, tiered by place (the
 * team, 2026-11-23). `hbar` is that division, 1st place first, worked out on
 * save: it's what the website and the payouts read. Empty for cash only.
 */
export type TournamentHederaPrize = { type: TournamentPrizeType; hbarPool: number; hbar: number[] };

/** The player's verified wallet, as the website backend stores it (the website's `WalletLink`). */
export type LinkedWallet = {
  /** Hedera account ID, `0.0.x`. Public on the network. */
  accountId: string;
  door: "existing" | "embedded";
  /** HashPack, or the embedded wallet's sign-in: Google or email. */
  provider: string;
  linkedAt: string;
};

/**
 * Where the winner's identity check stands, as stored. Whether one is needed
 * at all is worked out from the amount and the treasury's threshold
 * (`identityStatus` in `lib/hedera/payouts.ts`), so moving the threshold
 * moves every payout not yet sent.
 */
export type IdentitySubmission = {
  state: "none" | "submitted" | "verified" | "rejected";
  /** What the player sent, as the admin may see it: the ID number cut to its last four. */
  details?: { fullName: string; dateOfBirth: string; idType: "nin" | "passport" | "drivers" | "voters"; idLast4: string };
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Why it was rejected, as the player is told. */
  note?: string;
};

/** What the admin sees of the identity check: the stored state, read against the threshold. */
export type IdentityStatus = "notNeeded" | "waiting" | "toReview" | "verified" | "rejected";

/**
 * A payout's own status. The website shows a player fewer words: `verify`
 * while their identity check is needed and not verified, `pending` for
 * awaiting approval, held and sending, then `sent` or `failed`.
 */
export type PayoutStatus = "awaitingApproval" | "held" | "sending" | "sent" | "failed";

export type PrizePayout = {
  id: string;
  /** From the game backend's results feed. */
  tournament: { id: string; name: string };
  place: number;
  hbar: number;
  player: { id: string; name: string; handle: string };
  /** Null: the winner hasn't linked a wallet yet, so there is nowhere to pay. */
  wallet: LinkedWallet | null;
  identity: IdentitySubmission;
  status: PayoutStatus;
  /** When the results were confirmed and the payout was created. */
  createdAt: string;
  updatedAt: string;
  hold?: { reason: string; by: string; at: string };
  approvedBy?: string;
  approvedAt?: string;
  /** The transfer, once it's on the network. */
  txId: string | null;
  sentAt?: string;
  /** The last error, when it failed. */
  failure?: string;
  /**
   * Paid by hand, when the automated payout couldn't (the team, 2026-11-23):
   * an admin sent the HBAR from their own wallet and recorded the transfer.
   * The treasury didn't pay it, so its balance doesn't move.
   */
  manual?: { by: string; at: string; from: string; note?: string };
};

/* ---- Hedera jobs -------------------------------------------------------- */

export type JobKind = "mint" | "payment" | "payout";

/**
 * What went wrong. A mint that failed after every retry; a payment the
 * gateway never confirmed, one that came in short, or one that came in after
 * its quote expired; a payout the network refused.
 */
export type JobProblem = "mintFailed" | "paymentUnconfirmed" | "underpaid" | "paidAfterExpiry" | "payoutFailed";

/** What an admin can ask for. Which ones a job offers depends on its problem (`jobActions`). */
export type JobAction = "retry" | "recheck" | "refund";

export type JobStatus = "open" | "working" | "resolved";

export type HederaJob = {
  id: string;
  kind: JobKind;
  problem: JobProblem;
  status: JobStatus;
  /** A mint for a free claim, or for a purchase (where a refund is the way out). */
  via?: "claim" | "purchase";
  /** What it's for, as printed: an exclusive, an order, a prize. */
  item: string;
  /** The claim, order or payout it belongs to. */
  reference: string;
  /** The write's idempotency key: a retry with it never mints or pays twice. */
  idempotencyKey: string;
  player: { name: string; handle: string };
  /** The wallet it pays or mints to. */
  wallet: string;
  /** What should have arrived or gone out, in HBAR; null for a free mint. */
  hbar: number | null;
  /** What did arrive, for a payment. */
  paidHbar?: number;
  /** The transaction that is on the network, if any (the payment, for a payment problem). */
  txId: string | null;
  attempts: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
  /** While an admin's action runs. */
  working?: { action: JobAction; by: string; since: string };
  /** How it was closed. `paidManually`: a failed payout an admin paid by hand from Payouts. */
  resolution?: { action: JobAction | "paidManually"; by: string; at: string; txId: string | null };
};

/* ---- The treasury ------------------------------------------------------- */

export type TreasuryMovementKind = "sale" | "payout" | "refund" | "fees" | "topUp";

/** One movement on the treasury account. `hbar` is signed: in is positive, out negative. */
export type TreasuryMovement = {
  id: string;
  kind: TreasuryMovementKind;
  hbar: number;
  label: string;
  at: string;
  txId: string | null;
};

/** One month's money out, and in, in HBAR. `month` is "2026-11", Lagos time. */
export type TreasuryMonth = { month: string; payouts: number; refunds: number; fees: number; spent: number; received: number };

export type Treasury = {
  network: HederaNetwork;
  /** Goondu's treasury account, `0.0.x`. Public on the network. */
  accountId: string;
  balance: number;
  /** A warning when the balance drops below this. */
  alertBelow: number;
  /** Prizes above this need the winner's identity check. */
  identityThreshold: number;
  /**
   * Percent off a merch order paid in HBAR rather than by card or bank (the
   * team, 2026-11-23: ₦20,000 by card, ₦19,500 in HBAR). The website reads it.
   */
  hbarDiscountPct: number;
  /** Payouts approved but not yet on the network, plus those waiting for approval. */
  committed: { sending: number; awaitingApproval: number };
  updatedAt: string;
};

export type TreasurySettings = Pick<Treasury, "alertBelow" | "identityThreshold" | "hbarDiscountPct">;

/** What the layout needs for its badges and notices. */
export type HederaSummary = {
  /** Payouts an admin can approve now: identity cleared and a wallet to pay. */
  payoutsReady: number;
  jobsOpen: number;
  balance: number;
  alertBelow: number;
};
