/**
 * Admin data contracts.
 *
 * Pages and components only ever see these types, and only ever get them
 * through `src/lib/api/*`, which turn the API's replies into them. When a reply
 * changes, the adapter changes and nothing above it does.
 *
 * Money is an integer number of naira, never a float and never a formatted
 * string - the same rule the public site follows. Dates are ISO strings.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/**
 * A region's id, from the admin-managed Regions list: the API's id (a uuid),
 * or where a reply names it that way, its slug (e.g. "lagos"). `lib/regions.ts`
 * resolves either.
 */
export type RegionId = string;

/**
 * A region: managed by admins in Regions, and the list players pick from at
 * registration, so every player and tournament is counted against the same
 * names. Archived: kept for the people and tournaments already in it, but no
 * longer offered to new players or new tournaments.
 */
export type Region = {
  id: RegionId;
  /** "lagos": stable across renames. */
  slug: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  /** How many players are in it (since 2026-11-02). */
  playerCount?: number;
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

/** Someone who can sign in to the admin: Settings > Team. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  /** Their last sign-in; null if they haven't signed in yet. Left out when the API's date can't be read. */
  lastSeen?: string | null;
};

/** Settings > Store. */
export type StoreSettings = { lowStockAt: number };

/** Settings > Notifications: which emails the signed-in admin gets. */
export type NotificationSettings = { orders: boolean; stock: boolean; registrations: boolean; results: boolean };

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

/**
 * A product as the Products table lists it. The API's product list returns
 * these figures rather than whole products (no variants), so the table and the
 * stock notices work from this.
 */
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  type: ProductType;
  status: ProductStatus;
  exclusive: boolean;
  /** "₦10,000", "₦10,000 – ₦12,000", "Free", "Not on sale". */
  priceLabel: string;
  /** The lowest price, for sorting; null when nothing is on sale. */
  priceFrom: number | null;
  /** Comics: each format on sale, online first. Empty for merch. */
  formats: { format: ComicFormat; price: number; free: boolean }[];
  /** Units on hand; null for a comic sold only online. */
  stock: number | null;
  stockStatus: StockStatus | null;
  sold: number;
  createdAt: string;
};

/** The Products page's headline figures. Money in naira. */
export type ProductStats = {
  live: { total: number; merch: number; comics: number };
  sold: { total: number; merch: number; comics: number };
  restock: { count: number; titles: string[] };
  stockValue: number;
};

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
  /** The API doesn't send a volume's dates. */
  updatedAt?: string;
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
  /**
   * How the site draws the cover. "torn": its torn band over the top, with the
   * volume tag and title (art with no title on it). "full": the file as it is
   * (art that carries its own). Absent: "torn", as the site does.
   */
  coverStyle?: CoverStyle;
  /** The band's title. Empty uses the chapter title; a newline breaks the line. */
  coverTitle?: string;
  /** The plate above the title, "VOL. 1". Empty: no plate. Absent: never set. */
  coverVolume?: string;
  coverBand?: CoverBand;
  pages: ComicPage[];
  /** Publish date, or the scheduled date when status is "scheduled". */
  publishAt?: string;
  reads: number;
  /** Absent when the API doesn't send it. */
  updatedAt?: string;
};

export type CoverStyle = "torn" | "full";

/** The site's band colours, as its news covers offer them (`COVER_BAND` in `lib/labels.ts`). */
export type CoverBand = "menu" | "dusk" | "clot" | "ember" | "oxblood" | "blood" | "carmine" | "crimson" | "abyss" | "ash";

/** The Comics page's headline counts. */
export type ComicStats = {
  volumes: number;
  chapters: number;
  published: number;
  unpublished: number;
  reads: number;
  copiesSold: number;
  /** Chapters with a store listing. */
  inStore: number;
};

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/**
 * `pending` is paid and waiting to be worked on; `awaitingPayment` is placed,
 * not paid yet.
 */
export type OrderStatus = "awaitingPayment" | "pending" | "processing" | "inTransit" | "delivered" | "cancelled" | "refunded";
/** The API's own statuses. `OrderStatus` folds `paid` into `pending`, and `fulfilled` into `delivered`. */
export type ApiOrderStatus = "pending_payment" | "paid" | "fulfilled" | "cancelled" | "refunded" | "processing" | "in_transit" | "delivered";
/** `paystack` is what the API reports: Paystack takes cards, transfers and USSD alike. */
export type PaymentMethod = "paystack" | "bankTransfer" | "card";

/** One line of an order. The API sends a SKU but no product name or picture yet, so `name` may be the SKU and `image` absent. */
export type OrderLine = {
  kind: "product" | "comic";
  refId: string;
  name: string;
  image?: string;
  colour?: string;
  size?: ProductSize | string;
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

/**
 * Where it ships. Pickup needs only the state and local government, so the
 * street and city are absent. The API sends the address as one line of text,
 * `full`, rather than in parts.
 */
export type Address = {
  full?: string;
  line1?: string;
  city?: string;
  /** Local government, from `nigeria-lga-data` (e.g. "Nsukka"). */
  lga?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  phone?: string;
};

/** Fields the API's order record doesn't carry are optional: a screen shows a dash, never a made-up value. */
export type Order = {
  id: string;
  reference: string;
  customer: { id: string; name: string; email?: string; handle?: string };
  lines: OrderLine[];
  subtotal: number;
  pointsDiscount: number;
  shipping?: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  /** Present when something ships: Home Delivery or Pickup. */
  deliveryMethod?: DeliveryMethod;
  shippingAddress?: Address;
  placedAt: string;
  timeline: { status: OrderStatus; at: string }[];
  /** Where the API says it stands, finer than `status`. */
  apiStatus?: ApiOrderStatus;
  /**
   * The API's own stages for this order (`timelines`), in its order - reached
   * or not. The order page draws Progress from these; absent (the order list
   * sends none), it uses the standard flow.
   */
  stages?: OrderStatus[];
};

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

/** `order` and `tournamentEntry` are the API's: it doesn't say whether a store order was merch or a comic. */
export type TransactionType = "merch" | "comic" | "order" | "tournamentEntry" | "prizePayout" | "refund";
export type TransactionStatus = "successful" | "pending" | "failed" | "reversed";

export type Transaction = {
  id: string;
  reference: string;
  type: TransactionType;
  /** Money into Goondu is positive; payouts and refunds are money out. */
  direction: "in" | "out";
  amount: number;
  /** The processor's fee. The API doesn't report fees, so live transactions have none. */
  fee?: number;
  status: TransactionStatus;
  method: PaymentMethod;
  party: { name: string; email: string };
  /** The order or tournament this moved money for. */
  relatedId?: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Community                                                           */
/* ------------------------------------------------------------------ */

/**
 * Where a note is in moderation. The API's own `moderation_status`: a note a
 * player posts is `pending`, and only `approved` ones are on the public
 * Community Wall.
 */
export type NoteStatus = "pending" | "approved" | "rejected";

/** A note a player posted to the Community Wall. */
export type Note = {
  id: string;
  /** What they wrote: 3 to 140 characters, the API's bounds. */
  body: string;
  /** `handle` is null for a player with no username yet; `id` isn't in the API's reply. */
  author: { id?: string; handle: string | null; name: string };
  status: NoteStatus;
  likes: number;
  postedAt: string;
  /** The admin who approved or rejected it, and when. Absent while pending. */
  moderatedBy?: string;
  moderatedAt?: string;
};

export type NoteStats = { pending: number; approved: number; rejected: number; postedThisWeek: number };

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
export type MatchSide = {
  handle: string;
  points?: number;
  bye?: true;
  /** The player's id, which a result names as the winner. */
  playerId?: string;
};

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
  /** The entry's own id, which disqualifying names. */
  entryId?: string;
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
  /**
   * The API's qualifier leaderboard, when more players entered than the
   * 32-seat bracket holds - ranked, with who goes through. Absent: the admin
   * ranks the field itself (`qualifierRanking`).
   */
  qualifier?: { cutoff: number; entries: { rank: number; playerId: string; handle: string; points: number; through: boolean }[] };
  /** The rounds the field will play, before the bracket is drawn. */
  projected?: { label: string; matches: number }[];
};

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

export type PlayerStatus = "active" | "suspended" | "unverified";
export type Champion = "soma" | "kaira" | "ogbunabali";

/**
 * A player. The optional fields are ones the API's player record doesn't carry
 * yet (no email, region, game stats or spend); a screen shows a dash rather
 * than a made-up number.
 */
export type Player = {
  id: string;
  handle: string;
  name: string;
  email?: string;
  region?: RegionId;
  level?: number;
  winRate?: number;
  gamePoints?: number;
  main?: Champion;
  status: PlayerStatus;
  joinedAt: string;
  lastActiveAt?: string;
  tournamentsPlayed?: number;
  totalSpend?: number;
};

/** The headline counts on Players. */
export type PlayerStats = {
  total: number;
  activeThisWeek: number;
  unverified: number;
  suspended: number;
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/** `change` is a percentage against the range before; null when there's nothing to compare with. */
export type Trend = { value: number; change: number | null };

export type DashboardSummary = {
  revenue: Trend;
  orders: Trend;
  players: Trend;
  activeTournaments: Trend;
};

/** One line of the dashboard's Recent orders. */
export type DashboardRecentOrder = {
  id: string;
  reference: string;
  customer: string;
  image?: string;
  /** "Goondu Hoodie + 2 more". */
  summary: string;
  status: OrderStatus;
  total: number;
  placedAt: string;
};

/** A tournament on the dashboard. `slug` is absent when it has no page here yet. */
export type DashboardTournament = {
  id: string;
  slug?: string;
  name: string;
  status: TournamentStatus;
  /** The region's name, ready to print. */
  region: string;
  prizePool: number;
  slots: { taken: number; total: number | null };
};

/** Everything the dashboard shows, for one range. */
export type Dashboard = {
  summary: DashboardSummary;
  registrationsOpen: number;
  series: TimeSeriesPoint[];
  streams: ShareSlice[];
  units: ShareSlice[];
  playersByRegion: ShareSlice[];
  recentOrders: DashboardRecentOrder[];
  tournaments: DashboardTournament[];
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
  /** The API doesn't say when the promotion was last changed. */
  updatedAt?: string;
};

/** The Shipping page's cards. Prices are whole naira; a range is null before anything is priced. */
export type ShippingStats = {
  pricedStates: number;
  /** Cheapest to dearest, local governments priced on their own included. */
  homeDelivery: { min: number; max: number } | null;
  pickup: { min: number; max: number } | null;
  promo: "off" | "scheduled" | "live" | "ended";
};
