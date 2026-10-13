/**
 * Admin data contracts.
 *
 * THESE ARE THE SHAPES THE BACKEND WILL RETURN. Pages and components only ever
 * see these types, and only ever get them through `src/lib/api/*`. Today those
 * adapters resolve from the fixtures in `src/lib/mock/*`; when the endpoints
 * land, the adapters change and nothing above them does.
 *
 * Money is an integer number of naira, never a float and never a formatted
 * string - the same rule the public site follows. Dates are ISO strings.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** A region's id, from the admin-managed Regions list (e.g. "lagos"). */
export type RegionId = string;

/**
 * A region: managed by admins in Regions, and the list players pick from at
 * registration, so every player and tournament is counted against the same
 * names. Archived: kept for the people and tournaments already in it, but no
 * longer offered to new players or new tournaments.
 */
export type Region = {
  id: RegionId;
  name: string;
  status: "active" | "archived";
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export type AdminRole = "owner" | "admin" | "support";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar?: string;
  emailVerified: boolean;
};

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

/**
 * A product is one of two types, as the backend defines them: APPAREL
 * (clothing and accessories, sold by colourway and size) or COMICS (an issue
 * from the Comics section, sold online, in print, or both).
 */
export type ProductType = "apparel" | "comics";
export type ProductSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export type ProductStatus = "active" | "draft" | "archived";

/**
 * A colourway. The standard ones swatch with a brand token; one an admin adds
 * carries the hex they picked instead, since a token can't be made at runtime.
 */
export type ProductColour = {
  id: string;
  name: string;
  /** Tailwind background class for a standard colour. */
  swatch?: string;
  /** `#rrggbb` for a colour an admin added. */
  hex?: string;
};

/** One colour and size of an apparel product: its stock, and its price if it isn't the product's. */
export type ProductVariantStock = {
  colourId: string;
  size: ProductSize;
  quantity: number;
  /**
   * Set only when an admin overrides it. Absent, the variant sells at the
   * product's price, and follows it when that price changes.
   */
  price?: number;
};

/** What every product has, whatever its type. */
type ProductBase = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  exclusive: boolean;
  status: ProductStatus;
  createdAt: string;
};

export type ApparelProduct = ProductBase & {
  type: "apparel";
  price: number;
  colours: ProductColour[];
  sizes: ProductSize[];
  stock: ProductVariantStock[];
  unitsSold: number;
};

export type ComicFormat = "online" | "physical";

/** One way a comic is sold. Switched off keeps its price for next time. */
export type ComicOffer = { enabled: boolean; price: number; unitsSold: number };

export type ComicProduct = ProductBase & {
  type: "comics";
  /** The chapter this sells, from the Comics section. Name and image are taken from it. */
  comicId: string;
  formats: {
    /**
     * Free to read only when `free` is set, and then `price` is 0. An admin
     * turns it on deliberately: a blank or zero price never means free.
     */
    online: ComicOffer & { free: boolean };
    /** Print copies are physical stock. */
    physical: ComicOffer & { stock: number };
  };
};

export type Product = ApparelProduct | ComicProduct;

export type StockStatus = "inStock" | "lowStock" | "outOfStock";

/* ------------------------------------------------------------------ */
/* Comics                                                              */
/* ------------------------------------------------------------------ */

export type ComicStatus = "published" | "scheduled" | "draft";

export type ComicPage = {
  id: string;
  number: number;
  src: string;
};

/**
 * A volume: the collected edition. Chapters 1 to 10, say, compile into
 * Volume 1. It has its own title, synopsis and, optionally, cover.
 */
export type ComicVolume = {
  id: string;
  /** Volume 1, 2… Unique. */
  number: number;
  title: string;
  description: string;
  /** The collected edition's cover. Absent, its first chapter's cover stands in. */
  cover?: string;
  /** The printed volume, sold as one book. Online, a volume is only ever bought chapter by chapter. */
  edition?: VolumeEdition;
  updatedAt: string;
};

/**
 * The printed collected edition (the team's rules, 2026-10-01). It can be on
 * sale only while the volume is complete - every chapter published - and an
 * admin has switched it on. If the volume stops being complete it pauses
 * itself, and `pausedReason` says why.
 */
export type VolumeEdition = {
  enabled: boolean;
  price: number;
  stock: number;
  unitsSold: number;
  pausedReason?: string;
};

/**
 * A chapter: one comic book, with its own pages, cover and release, e.g.
 * Vol. 1, Chapter 1 "Testing Waters". Chapters are what readers buy and read.
 * How one is SOLD is not here - that is its product, of type `comics`, in Products.
 */
export type Comic = {
  id: string;
  slug: string;
  /** The volume this chapter is compiled into. */
  volumeId: string;
  /** Its place in the volume: 1, 2, 3… Unique within the volume. */
  chapter: number;
  /** The chapter's own title. */
  title: string;
  description: string;
  status: ComicStatus;
  cover: string;
  pages: ComicPage[];
  /** Publish date, or the scheduled date when status is "scheduled". */
  publishAt?: string;
  reads: number;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export type OrderStatus = "pending" | "processing" | "inTransit" | "delivered" | "cancelled";
export type PaymentMethod = "bankTransfer" | "card";

export type OrderLine = {
  kind: "product" | "comic";
  refId: string;
  name: string;
  image: string;
  colour?: string;
  size?: ProductSize;
  /** Comics only: which edition was bought. Online needs no shipping. */
  format?: ComicFormat;
  quantity: number;
  unitPrice: number;
};

/**
 * How an order reaches the customer. Home Delivery goes to their door; Pickup
 * goes to a transport company's collection centre in their local government,
 * for customers who'd rather not share a home address (NDPR).
 */
export type DeliveryMethod = "homeDelivery" | "pickup";

/** Where it ships. Pickup needs only the state and local government, so the street and city are absent. */
export type Address = {
  line1?: string;
  city?: string;
  /** Local government, from `nigeria-lga-data` (e.g. "Nsukka"). */
  lga: string;
  state: string;
  country: string;
  phone: string;
};

export type Order = {
  id: string;
  reference: string;
  customer: { id: string; name: string; email: string; handle?: string };
  lines: OrderLine[];
  subtotal: number;
  pointsDiscount: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  /** Present when something ships: Home Delivery or Pickup. */
  deliveryMethod?: DeliveryMethod;
  shippingAddress?: Address;
  placedAt: string;
  timeline: { status: OrderStatus; at: string }[];
};

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export type TransactionType = "merch" | "comic" | "prizePayout" | "refund";
export type TransactionStatus = "successful" | "pending" | "failed" | "reversed";

export type Transaction = {
  id: string;
  reference: string;
  type: TransactionType;
  /** Money into Goondu is positive; payouts and refunds are money out. */
  direction: "in" | "out";
  amount: number;
  fee: number;
  status: TransactionStatus;
  method: PaymentMethod;
  party: { name: string; email: string };
  /** The order or tournament this moved money for. */
  relatedId?: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

/** The public site's statuses plus the two an admin needs after the fact. */
export type TournamentStatus =
  | "draft"
  | "comingSoon"
  | "registrationOpen"
  | "active"
  | "completed"
  | "cancelled";

export type TournamentFormat = "oneVone";

export type StageKey =
  | "registration"
  | "qualifiers"
  | "groupStage"
  | "roundOf16"
  | "quarterFinals"
  | "semiFinals"
  | "finals";

/** `skipped`: a stage this tournament doesn't need - Qualifiers with 32 or fewer players, a round bigger than its bracket. */
export type StageStatus = "completed" | "inProgress" | "upcoming" | "skipped";

/** A stage in the Journey: when it starts, and for Qualifiers when its leaderboard window closes. */
export type Stage = { key: StageKey; status: StageStatus; startsAt?: string; endsAt?: string };

/**
 * One side of a match. `bye` is the dummy player: it stands in for a missing
 * opponent (an odd count, a disqualified or suspended player) and always
 * loses, so the real player advances.
 */
export type MatchSide = { handle: string; points?: number; bye?: true };

export type Match = {
  id: string;
  sides: [MatchSide | null, MatchSide | null];
  endsAt?: string;
  scheduledAt?: string;
  playedAt?: string;
  /** Won against a bye: decided by the system, not played. */
  walkover?: true;
  /** Which side won, once played. */
  winner?: 0 | 1;
};

/** The knockout rounds, each a stage: Group stage is the 32-player round. */
export type RoundKey = Exclude<StageKey, "registration" | "qualifiers">;
export type BracketRound = { key: RoundKey; matches: Match[] };

export type Participant = {
  playerId: string;
  handle: string;
  region: RegionId;
  seed: number;
  points: number;
  status: "registered" | "active" | "eliminated" | "champion";
  registeredAt: string;
};

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: TournamentStatus;
  /**
   * The region it's for, from the Regions list, or `"global"` (GLOBAL_REGION in
   * `lib/regions.ts`) for a tournament open to every region.
   */
  region: RegionId;
  format: TournamentFormat;
  startsAt?: string;
  endsAt?: string;
  registrationClosesAt?: string;
  /** Whole naira. */
  prizePool: number;
  /**
   * Each paid position's share of the pool, in percent: `[0]` is 1st place.
   * As many positions as the tournament pays; `[100]` is winner takes all.
   * Totals 100.
   */
  prizeSplit: number[];
  /** `total` is null when slots are unlimited. */
  slots: { taken: number; total: number | null };
  /** Whether in-game rewards (skins, titles, frames) are on offer. The items themselves are set up in the game backend. */
  inGameRewards: boolean;
  stages: Stage[];
  bracket: BracketRound[];
  participants: Participant[];
  featured: boolean;
};

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

export type PlayerStatus = "active" | "suspended" | "unverified";
export type Champion = "soma" | "kaira" | "ogbunabali";

export type Player = {
  id: string;
  handle: string;
  name: string;
  email: string;
  region: RegionId;
  level: number;
  winRate: number;
  gamePoints: number;
  main: Champion;
  status: PlayerStatus;
  joinedAt: string;
  lastActiveAt: string;
  tournamentsPlayed: number;
  totalSpend: number;
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type Trend = { value: number; change: number };

export type DashboardSummary = {
  revenue: Trend;
  orders: Trend;
  players: Trend;
  activeTournaments: Trend;
};

export type TimeSeriesPoint = { label: string; value: number };
export type Period = "daily" | "weekly" | "monthly";

export type ShareSlice = { key: string; label: string; value: number };

/* ------------------------------------------------------------------ */
/* Shipping                                                            */
/* ------------------------------------------------------------------ */

/** One local government's own prices. A side left out uses the state's price. */
export type LgaShipping = { homeDelivery?: number; pickup?: number };

/**
 * What shipping costs to a state, set by admins: a Home Delivery and a Pickup
 * price for the whole state, and overrides for any local government that
 * costs more or less. Keys of `lgas` are `nigeria-lga-data` ids.
 */
export type StateShipping = {
  state: string;
  homeDelivery: number;
  pickup: number;
  lgas: Record<string, LgaShipping>;
  updatedAt: string;
};

/**
 * Free shipping for a promotional campaign (the team, 2026-10-01): while it
 * runs, an order whose items total at least `minimumOrder` ships free, by
 * either method, anywhere. Off, or outside its dates, every order pays its
 * place's price. No dates means it runs from now until switched off.
 */
export type FreeShippingPromo = {
  enabled: boolean;
  /** Whole naira, measured on the items total before points. 0 means every order. */
  minimumOrder: number;
  startsAt?: string;
  endsAt?: string;
  updatedAt: string;
};
