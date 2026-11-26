import type {
  ApiOrderStatus,
  Champion,
  ComicFormat,
  ComicStatus,
  CoverBand,
  NoteStatus,
  Order,
  OrderStatus,
  PaymentMethod,
  PlayerStatus,
  ProductStatus,
  ProductType,
  RoundKey,
  StageKey,
  StockStatus,
  TournamentStatus,
  TransactionStatus,
  TransactionType,
} from "@/types";
import type {
  AssetFamily,
  AssetRarity,
  IdentityStatus,
  IdentitySubmission,
  JobAction,
  JobKind,
  JobProblem,
  JobStatus,
  PayoutStatus,
  StoreItemState,
  TournamentPrizeType,
  TreasuryMovementKind,
} from "@/types/hedera";

/**
 * Human labels for every enum the admin prints, and the tone its badge takes.
 * Kept in one file so a status never reads two different ways on two screens.
 */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

/** `hint` explains the label on hover, for one a word alone could mislead. */
type Labelled = { label: string; tone: Tone; hint?: string };

export const ORDER_STATUS: Record<OrderStatus, Labelled> = {
  awaitingPayment: { label: "Awaiting payment", tone: "neutral" },
  pending: { label: "Paid", tone: "warning" },
  processing: { label: "Processing", tone: "neutral" },
  inTransit: { label: "In Transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};

/** The API's own names for an order's status. */
export const API_ORDER_STATUS_LABEL: Record<ApiOrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  in_transit: "In Transit",
  delivered: "Delivered",
  fulfilled: "Fulfilled",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** An order's badge: its tone, named as the API names it where that's known. */
export function orderBadge(order: Pick<Order, "status" | "apiStatus">): Labelled {
  const badge = ORDER_STATUS[order.status];
  return order.apiStatus ? { ...badge, label: API_ORDER_STATUS_LABEL[order.apiStatus] } : badge;
}

export const TRANSACTION_STATUS: Record<TransactionStatus, Labelled> = {
  successful: { label: "Successful", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  reversed: { label: "Reversed", tone: "neutral" },
};

export const TRANSACTION_TYPE: Record<TransactionType, string> = {
  merch: "Merch sale",
  comic: "Comic sale",
  order: "Store order",
  tournamentEntry: "Tournament entry",
  prizePayout: "Prize payout",
  refund: "Refund",
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  paystack: "Paystack",
  bankTransfer: "Bank transfer",
  card: "Card",
};

export const PRODUCT_STATUS: Record<ProductStatus, Labelled> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "danger" },
};

export const STOCK_STATUS: Record<StockStatus, Labelled> = {
  inStock: { label: "In stock", tone: "success" },
  lowStock: { label: "Low stock", tone: "warning" },
  outOfStock: { label: "Out of stock", tone: "danger" },
};

export const COMIC_STATUS: Record<ComicStatus, Labelled> = {
  published: { label: "Published", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
};

export const COMIC_FORMAT: Record<ComicFormat, string> = {
  online: "Online",
  physical: "Physical",
};

/**
 * A titled cover's band colours: the site's tokens, as its news covers offer them,
 * with the hex the chapter form's preview paints. The chip pairs as the site pairs
 * it: the blue plate on the cool bands, the cream one on the reds.
 */
export const COVER_BAND: Record<CoverBand, { label: string; hex: string; chip: string }> = {
  menu: { label: "Near-black", hex: "#1a1a1a", chip: "#e1d3a0" },
  dusk: { label: "Grey-blue", hex: "#292d32", chip: "#5ec1ce" },
  clot: { label: "Dark red", hex: "#680500", chip: "#e1d3a0" },
  ember: { label: "Deep red", hex: "#800c00", chip: "#e1d3a0" },
  oxblood: { label: "Darkest red", hex: "#310400", chip: "#e1d3a0" },
  blood: { label: "Red", hex: "#a00000", chip: "#e1d3a0" },
  carmine: { label: "Bright red", hex: "#be0000", chip: "#e1d3a0" },
  crimson: { label: "Crimson", hex: "#d10023", chip: "#e1d3a0" },
  abyss: { label: "Black-blue", hex: "#12181b", chip: "#5ec1ce" },
  ash: { label: "Dark grey", hex: "#282828", chip: "#5ec1ce" },
};

/** The backend's two product types. `apparel` is shown as Merch: the section is Products, and Merch is its clothing category. */
export const PRODUCT_TYPE: Record<ProductType, string> = {
  apparel: "Merch",
  comics: "Comics",
};

export const TOURNAMENT_STATUS: Record<TournamentStatus, Labelled> = {
  draft: { label: "Draft", tone: "neutral" },
  comingSoon: { label: "Coming soon", tone: "neutral" },
  registrationOpen: { label: "Registration open", tone: "brand" },
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "info" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const PLAYER_STATUS: Record<PlayerStatus, Labelled> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  unverified: { label: "Unverified", tone: "warning" },
  unknown: { label: "Unknown", tone: "neutral", hint: "The server didn't say whether this player has confirmed their email." },
};

export const NOTE_STATUS: Record<NoteStatus, Labelled> = {
  pending: { label: "Live, being checked", tone: "info", hint: "On the wall and queued for the automatic check." },
  flagged: { label: "Flagged", tone: "warning", hint: "The automatic check took it off the wall. Restore it or take it down." },
  approved: { label: "On the wall", tone: "success" },
  rejected: { label: "Taken down", tone: "danger" },
};

/**
 * The community rules, as the player is told which one a note broke: the
 * filter guide's `rule_label` table (2026-11-17), capitalised as the API's
 * own example ("Advertising"). Keyed by the filter list's rule keys, so a
 * flagged note's matches name their rule; `profanity_*` and the contact keys
 * share one label each, as the guide groups them. The take-down picker offers
 * the labels in the guide's priority order - all but self-harm: the guide
 * says that player is NOT emailed, and the team reaches out personally, so an
 * urgent note is taken down with no rule at all (`rule_category` is optional).
 * FLAGGED to the backend: a reject without a rule must send no email.
 */
export const NOTE_RULES: { key: string; label: string }[] = [
  { key: "self_harm", label: "Self-harm" },
  { key: "underage", label: "Account eligibility" },
  { key: "personal_info", label: "Sharing personal information" },
  { key: "violence_threats", label: "Threats" },
  { key: "hate_slurs", label: "Hate speech" },
  { key: "sexual_content", label: "Sexual content" },
  { key: "scam_fraud", label: "Scams and cheats" },
  { key: "impersonation", label: "Pretending to be staff" },
  { key: "drugs", label: "Drugs" },
  { key: "gambling_betting", label: "Betting" },
  { key: "contact", label: "Sharing links and contact details" },
  { key: "profanity", label: "Strong language" },
  { key: "political", label: "Politics" },
  { key: "religious", label: "Religion" },
  { key: "marketing_spam", label: "Advertising" },
  { key: "competitor_brands", label: "Other games" },
];

/** A list key as the filter writes it (`profanity_igbo`, `url_and_number_patterns`) to its rule. */
export function noteRuleKey(key: string): string {
  if (key.startsWith("profanity_")) return "profanity";
  if (key === "contact_solicitation" || key === "url_and_number_patterns") return "contact";
  return key;
}

/** The label for a rule key; an unknown one reads as it came. */
export function noteRuleLabel(key: string): string {
  const rule = noteRuleKey(key);
  return NOTE_RULES.find((r) => r.key === rule)?.label ?? key.replace(/_/g, " ");
}

export const CHAMPION: Record<Champion, string> = {
  soma: "Soma",
  kaira: "Kaira",
  ogbunabali: "Ogbun'abali",
};


export const STAGE: Record<StageKey, string> = {
  registration: "Registration",
  qualifiers: "Qualifiers",
  groupStage: "Group stage",
  roundOf16: "Round of 16",
  quarterFinals: "Quarter-finals",
  semiFinals: "Semi-finals",
  finals: "Finals",
};

/** Knockout round names on the bracket. Group stage is the 32-player round. */
export const ROUND: Record<RoundKey, string> = {
  groupStage: "Group stage",
  roundOf16: "Round of 16",
  quarterFinals: "Quarter-finals",
  semiFinals: "Semi-finals",
  finals: "Final",
};

/* ---- Hedera (behind HEDERA_MOCK; see lib/hedera/mode.ts) ---------------- */

export const STORE_ITEM_STATE: Record<StoreItemState, Labelled> = {
  draft: { label: "Draft", tone: "neutral", hint: "Never been on the store" },
  scheduled: { label: "Scheduled", tone: "info", hint: "Published; the sale window hasn't opened yet" },
  live: { label: "On the store", tone: "success" },
  soldOut: { label: "Sold out", tone: "warning", hint: "The whole edition has gone to players" },
  ended: { label: "Ended", tone: "neutral", hint: "The sale window has closed" },
  unpublished: { label: "Unpublished", tone: "neutral", hint: "Taken off the store. Players who have it keep it." },
};

export const ASSET_FAMILY: Record<AssetFamily, string> = { skin: "Skin", weapon: "Weapon", character: "Character" };

/** The collection each family mints into, as the admin reads it. */
export const ASSET_COLLECTION: Record<AssetFamily, string> = { skin: "Skins", weapon: "Weapons", character: "Characters" };

export const ASSET_RARITY: Record<AssetRarity, Labelled> = {
  common: { label: "Common", tone: "neutral" },
  rare: { label: "Rare", tone: "info" },
  epic: { label: "Epic", tone: "brand" },
  legendary: { label: "Legendary", tone: "warning" },
};

export const PRIZE_TYPE: Record<TournamentPrizeType, { label: string; body: string }> = {
  cash: { label: "Cash", body: "Naira, as now." },
  hbar: { label: "HBAR", body: "HBAR only, to each winner's linked wallet." },
  both: { label: "Cash + HBAR", body: "Naira and HBAR for each paid place." },
};

export const PAYOUT_STATUS: Record<PayoutStatus, Labelled> = {
  awaitingApproval: { label: "Awaiting approval", tone: "warning" },
  held: { label: "On hold", tone: "neutral" },
  sending: { label: "Sending", tone: "info", hint: "Approved; the Hedera service is sending it" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Failed", tone: "danger", hint: "The network refused it. Retry from Hedera jobs." },
};

export const IDENTITY_STATUS: Record<IdentityStatus, Labelled> = {
  notNeeded: { label: "Not needed", tone: "neutral", hint: "The prize is under the identity-check threshold" },
  waiting: { label: "Waiting for player", tone: "neutral", hint: "The winner hasn't sent their identity check yet" },
  toReview: { label: "To review", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Rejected", tone: "danger", hint: "Waiting for the winner to send it again" },
};

export const ID_TYPE: Record<NonNullable<IdentitySubmission["details"]>["idType"], string> = {
  nin: "NIN",
  passport: "International passport",
  drivers: "Driver's licence",
  voters: "Voter's card (PVC)",
};

export const JOB_KIND: Record<JobKind, string> = { mint: "Mint", payment: "Payment", payout: "Payout" };

export const JOB_PROBLEM: Record<JobProblem, Labelled> = {
  mintFailed: { label: "Mint failed", tone: "danger" },
  paymentUnconfirmed: { label: "Payment not confirmed", tone: "warning", hint: "The gateway hasn't confirmed a payment the Mirror Node shows" },
  underpaid: { label: "Underpaid", tone: "warning" },
  paidAfterExpiry: { label: "Paid after expiry", tone: "warning", hint: "The HBAR arrived after the quote expired" },
  payoutFailed: { label: "Payout failed", tone: "danger" },
};

export const JOB_STATUS: Record<JobStatus, Labelled> = {
  open: { label: "Needs action", tone: "danger" },
  working: { label: "Working", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
};

/** The button, and what the job says while it runs and once it's done. */
export const JOB_ACTION: Record<JobAction, { label: string; working: string; done: string }> = {
  retry: { label: "Retry", working: "Retrying", done: "Retried" },
  recheck: { label: "Check again", working: "Checking the Mirror Node", done: "Confirmed on the Mirror Node" },
  refund: { label: "Refund", working: "Refunding", done: "Refunded" },
};

export const MOVEMENT_KIND: Record<TreasuryMovementKind, string> = {
  sale: "Store sale",
  payout: "Prize payout",
  refund: "Refund",
  fees: "Network fees",
  topUp: "Top-up",
};
