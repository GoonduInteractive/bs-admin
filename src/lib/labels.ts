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

/**
 * Human labels for every enum the admin prints, and the tone its badge takes.
 * Kept in one file so a status never reads two different ways on two screens.
 */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

type Labelled = { label: string; tone: Tone };

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
};

export const NOTE_STATUS: Record<NoteStatus, Labelled> = {
  pending: { label: "Waiting for review", tone: "warning" },
  approved: { label: "On the wall", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

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
