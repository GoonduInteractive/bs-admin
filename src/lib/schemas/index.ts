import { z } from "zod";
import { SPLIT_TOLERANCE, splitTotal } from "@/lib/tournaments";
import { CUSTOM_COLOUR_ID, MAX_CUSTOM_COLOURS, STANDARD_COLOURS, STANDARD_COLOUR_IDS, colourNameTaken } from "@/lib/colours";
import { COVER_BAND } from "@/lib/labels";
import type { CoverBand } from "@/types";

/**
 * Form and action schemas. The same schema validates in the browser (through
 * react-hook-form) and again in the server action, so a request that skips
 * the form is still checked.
 */

/* ---- Auth -------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyInput = z.infer<typeof verifySchema>;

/** Accepting an invite: the password they'll sign in with. 8+ characters, as sign-in asks. */
export const acceptInviteSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/* ---- Settings ---------------------------------------------------------- */

/** Owners aren't invited: someone is made one from the team list. */
export const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "Enter their first name"),
  lastName: z.string().trim().min(1, "Enter their last name"),
  email: z.email("Enter a valid email"),
  role: z.enum(["admin", "support"]),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const storeSettingsSchema = z.object({
  lowStockAt: z.coerce.number<number>().int("Use a whole number").min(1, "At least 1"),
});
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export const notificationSettingsSchema = z.object({
  orders: z.boolean(),
  stock: z.boolean(),
  registrations: z.boolean(),
  results: z.boolean(),
});

/* ---- Products ---------------------------------------------------------- */

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

type Need = (ok: boolean, path: (string | number)[], message: string) => void;

/**
 * How a chapter is sold: online (paid, or free by choice) and in print.
 * Prices are the typed text, not numbers: coercing would turn an emptied box
 * into ₦0, and ₦0 used to mean free. A blank price is an error on a format
 * that's on sale; free is its own switch.
 */
const comicFormatsSchema = z.object({
  online: z.object({ enabled: z.boolean(), free: z.boolean(), price: z.string().trim() }),
  physical: z.object({
    enabled: z.boolean(),
    price: z.string().trim(),
    stock: z.coerce.number<number>().int("Whole copies only").min(0, "Stock can't be negative"),
  }),
});

/** Only a format that's switched on needs a price; a switched-off one keeps whatever it had. */
function checkComicPrices({ online, physical }: z.infer<typeof comicFormatsSchema>, need: Need) {
  if (online.enabled && !online.free) {
    const path = ["formats", "online", "price"];
    need(online.price !== "", path, "Set a price, or turn on Free to read");
    if (online.price !== "") {
      need(/^\d+$/.test(online.price), path, "Whole naira only");
      need(Number(online.price) > 0, path, "₦0 isn't a price. To give it away, turn on Free to read");
    }
  }
  if (physical.enabled) {
    const path = ["formats", "physical", "price"];
    need(physical.price !== "", path, "Set the print price");
    if (physical.price !== "") {
      need(/^\d+$/.test(physical.price), path, "Whole naira only");
      need(Number(physical.price) >= 500, path, "Minimum print price is ₦500");
    }
  }
}

/** A colourway an admin adds to one product: their name, and the swatch they picked. */
export const customColourSchema = z.object({
  id: z.string().regex(CUSTOM_COLOUR_ID, "Invalid colour"),
  name: z.string().trim().min(1, "Name the colour").max(24, "Keep colour names under 24 characters"),
  hex: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a swatch colour"),
});
export type CustomColourInput = z.infer<typeof customColourSchema>;

/**
 * The add/edit product form. A product is APPAREL or COMICS - the backend's
 * two types - and each type fills its own fields, so the schema is one flat
 * form checked per type rather than two forms.
 */
export const productSchema = z
  .object({
    type: z.enum(["apparel", "comics"]),
    status: z.enum(["active", "draft", "archived"]),
    exclusive: z.boolean(),
    description: z.string().trim().max(600),

    // Apparel
    name: z.string().trim().max(60),
    price: z.coerce.number<number>().int("Whole naira only"),
    /** Selected colourway ids: standard ones, then this product's custom ones. */
    colours: z.array(z.string()),
    /** Colours added to this product. Each is always selected: removing one deletes it. */
    customColours: z.array(customColourSchema).max(MAX_CUSTOM_COLOURS, `Up to ${MAX_CUSTOM_COLOURS} added colours`),
    sizes: z.array(z.enum(SIZES)),
    /** Stock per colour and size, keyed `${colourId}:${size}`. */
    stock: z.record(z.string(), z.coerce.number<number>().int().min(0)),
    /** Whether any variant is priced apart from the product. Off, every variant sells at `price`. */
    customPrices: z.boolean(),
    /**
     * Price overrides, keyed like `stock`. Blank means the variant inherits
     * `price`: an override is stored only where an admin typed one.
     */
    prices: z.record(z.string(), z.string().trim()),
    image: z.string(),

    // Comics
    comicId: z.string(),
    formats: comicFormatsSchema,
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: (string | number)[], message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path, message });
    };
    if (v.type === "apparel") {
      need(v.name.length >= 2, ["name"], "Give the product a name");
      need(v.description.length >= 10, ["description"], "Describe it in a sentence or two");
      need(v.price >= 500, ["price"], "Minimum price is ₦500");
      need(v.colours.length > 0, ["colours"], "Pick at least one colourway");
      const known = new Set([...STANDARD_COLOUR_IDS, ...v.customColours.map((c) => c.id)]);
      need(v.colours.every((id) => known.has(id)), ["colours"], "Pick colourways from the list");
      v.customColours.forEach((c, i) => {
        const before = [...STANDARD_COLOURS, ...v.customColours.slice(0, i)];
        need(!colourNameTaken(c.name, before), ["customColours", i, "name"], `There's already a colour called ${c.name}`);
      });
      need(v.sizes.length > 0, ["sizes"], "Pick at least one size");
      need(!!v.image, ["image"], "Add a product image");
      if (v.customPrices) {
        for (const c of v.colours) {
          for (const size of v.sizes) {
            const key = `${c}:${size}`;
            const raw = v.prices[key] ?? "";
            if (!raw) continue;
            const n = Number(raw);
            need(Number.isInteger(n), ["prices", key], "Whole naira only");
            need(n >= 500, ["prices", key], "Minimum price is ₦500");
          }
        }
      }
    } else {
      need(!!v.comicId, ["comicId"], "Pick the chapter this sells");
      need(
        v.status !== "active" || v.formats.online.enabled || v.formats.physical.enabled,
        ["formats"],
        "Sell it online, in print, or both before it goes live",
      );
      checkComicPrices(v.formats, need);
    }
  });
export type ProductInput = z.infer<typeof productSchema>;

/**
 * The price a chapter must have before it can be scheduled or published -
 * asked for in the chapter form's price prompt. The same fields and rules as
 * a comics product, and at least one way to buy it.
 */
export const chapterPricingSchema = z.object({ formats: comicFormatsSchema }).superRefine((v, ctx) => {
  const need: Need = (ok, path, message) => {
    if (!ok) ctx.addIssue({ code: "custom", path, message });
  };
  need(v.formats.online.enabled || v.formats.physical.enabled, ["formats"], "Sell it online, in print, or both");
  checkComicPrices(v.formats, need);
});
export type ChapterPricingInput = z.infer<typeof chapterPricingSchema>;

/* ---- Comics ------------------------------------------------------------ */

/** A volume: the collected edition its chapters compile into. */
export const volumeSchema = z.object({
  number: z.coerce.number<number>().int("Whole numbers only").min(1, "Volumes start at 1"),
  title: z.string().trim().min(2, "Give the volume a title").max(80),
  description: z.string().trim().max(800),
  /** Optional: blank, the first chapter's cover stands in. */
  cover: z.string(),
  /** The printed volume. On sale only once every chapter is published (checked on save). */
  /** Typed text, so a cleared box is an error rather than ₦0. */
});
export type VolumeInput = z.infer<typeof volumeSchema>;

/** A chapter: one comic book, in a volume. */
export const comicSchema = z
  .object({
    title: z.string().trim().min(2, "Give the chapter a title").max(80),
    volumeId: z.string().min(1, "Pick the volume this chapter belongs to"),
    chapter: z.coerce.number<number>().int("Whole numbers only").min(1, "Chapters start at 1"),
    description: z.string().trim().max(800),
    status: z.enum(["published", "scheduled", "draft"]),
    publishAt: z.string().optional(),
    cover: z.string().min(1, "Upload a cover"),
    coverStyle: z.enum(["torn", "full"]),
    coverTitle: z.string().trim().max(80),
    coverVolume: z.string().trim().max(20, "Keep the volume tag short, like VOL. 1"),
    coverBand: z.enum(Object.keys(COVER_BAND) as [CoverBand, ...CoverBand[]]),
    pages: z.array(z.object({ id: z.string(), src: z.string() })).min(1, "Upload at least one page"),
  })
  .refine((v) => v.status !== "scheduled" || !!v.publishAt, {
    path: ["publishAt"],
    message: "Pick a release date for a scheduled chapter",
  });
export type ComicInput = z.infer<typeof comicSchema>;

/* ---- Shipping ---------------------------------------------------------- */

// Every price is more than nothing: free shipping comes only from the promotion (2026-10-01).
const naira = z.coerce.number<number>().int("Whole naira only").min(1, "Enter a price. For free shipping, run a promotion");

/**
 * A state's shipping prices. Local government overrides are the typed text:
 * blank means "use the state's price", so it can't be coerced to 0.
 */
export const stateShippingSchema = z
  .object({
    homeDelivery: naira,
    pickup: naira,
    lgas: z.record(z.string(), z.object({ homeDelivery: z.string().trim(), pickup: z.string().trim() })),
  })
  .superRefine((v, ctx) => {
    for (const [id, o] of Object.entries(v.lgas)) {
      for (const side of ["homeDelivery", "pickup"] as const) {
        if (o[side] && !/^\d+$/.test(o[side])) ctx.addIssue({ code: "custom", path: ["lgas", id, side], message: "Whole naira only" });
        else if (o[side] && Number(o[side]) < 1)
          ctx.addIssue({ code: "custom", path: ["lgas", id, side], message: "Shipping can't be free: enter a price, or leave it blank" });
      }
    }
  });
export type StateShippingInput = z.infer<typeof stateShippingSchema>;

/**
 * The free shipping promotion. Dates are Lagos `datetime-local` text, blank
 * for none; the minimum is typed text so a blank isn't read as 0.
 */
export const freeShippingSchema = z
  .object({
    enabled: z.boolean(),
    minimumOrder: z.string().trim(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.minimumOrder) ctx.addIssue({ code: "custom", path: ["minimumOrder"], message: "Enter a minimum order, or 0 for every order" });
    else if (!/^\d+$/.test(v.minimumOrder)) ctx.addIssue({ code: "custom", path: ["minimumOrder"], message: "Whole naira only" });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end has to come after the start" });
  });
export type FreeShippingInput = z.infer<typeof freeShippingSchema>;

/* ---- Regions ----------------------------------------------------------- */

/** Add or rename a region. Unique names are checked on save, against the list. */
export const regionSchema = z.object({
  name: z.string().trim().min(2, "Give the region a name").max(40, "Keep region names under 40 characters"),
});
export type RegionInput = z.infer<typeof regionSchema>;

/* ---- Tournaments ------------------------------------------------------- */

export const tournamentSchema = z
  .object({
    name: z.string().trim().min(3, "Give the tournament a name").max(60),
    description: z.string().trim().min(10, "Describe it for players").max(600),
    /** A region id from the Regions list, or "global". Checked against the list on save. */
    region: z.string().min(1, "Pick a region"),
    status: z.enum(["draft", "comingSoon", "registrationOpen"]),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    registrationClosesAt: z.string().optional(),
    prizePool: z.coerce.number<number>().int("Whole naira only").min(0, "Prize pool can't be negative"),
    /**
     * Each paid position's percentage of the pool, 1st place first. As many
     * positions as the admin wants; objects because the form edits them as a list.
     */
    prizeSplit: z
      .array(
        z.object({
          share: z.coerce
            .number<number>()
            .gt(0, "Every paid position needs a share")
            .max(100, "No position can take more than 100%")
            // The API takes two decimals (since 2026-10-27; it refused them before). Compared with
            // a hair of tolerance: 33.34 * 100 is 3334.0000000000005 in floating point, and an
            // exact test refused Split evenly's own 1st place.
            .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Two decimal places at most"),
        }),
      )
      .min(1, "Pay at least one position"),
    /** On, anyone can register; `slots` is ignored. */
    unlimitedSlots: z.boolean(),
    slots: z.coerce.number<number>().int("Whole players only"),
    /** Rewards on offer or not; the items are set up in the game backend. */
    inGameRewards: z.boolean(),
    featured: z.boolean(),
  })
  .refine((v) => v.unlimitedSlots || v.slots >= 2, { path: ["slots"], message: "A tournament needs at least 2 slots" })
  .refine((v) => v.unlimitedSlots || v.slots <= 100_000, { path: ["slots"], message: "Over 100,000 slots? Make it unlimited" })
  // An even cap pairs everyone off. (Unlimited fields end even too: over 32 go through
  // Qualifiers to exactly 32, and any empty seat in a smaller bracket is a bye.)
  .refine((v) => v.unlimitedSlots || v.slots % 2 === 0, { path: ["slots"], message: "Use an even number so every player has an opponent" })
  .refine((v) => Math.abs(splitTotal(v.prizeSplit.map((p) => p.share)) - 100) <= SPLIT_TOLERANCE, {
    path: ["prizeSplit"],
    message: "The shares must add up to 100%",
  })
  .refine((v) => v.unlimitedSlots || v.prizeSplit.length <= v.slots, {
    path: ["prizeSplit"],
    message: "More paid positions than player slots",
  })
  .refine((v) => v.status !== "registrationOpen" || (!!v.startsAt && !!v.registrationClosesAt), {
    path: ["registrationClosesAt"],
    message: "Open registration needs a start date and a closing date",
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    path: ["endsAt"],
    message: "End date must be after the start date",
  })
  .refine((v) => !v.startsAt || !v.registrationClosesAt || v.registrationClosesAt <= v.startsAt, {
    path: ["registrationClosesAt"],
    message: "Registration must close before the tournament starts",
  });
export type TournamentInput = z.infer<typeof tournamentSchema>;
