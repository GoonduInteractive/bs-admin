import type {
  Champion,
  ComicFormat,
  ComicStatus,
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
  pending: { label: "Pending", tone: "warning" },
  processing: { label: "Processing", tone: "neutral" },
  inTransit: { label: "In Transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const TRANSACTION_STATUS: Record<TransactionStatus, Labelled> = {
  successful: { label: "Successful", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  reversed: { label: "Reversed", tone: "neutral" },
};

export const TRANSACTION_TYPE: Record<TransactionType, string> = {
  merch: "Merch sale",
  comic: "Comic sale",
  prizePayout: "Prize payout",
  refund: "Refund",
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
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
