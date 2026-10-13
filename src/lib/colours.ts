import type { ProductColour } from "@/types";

/**
 * Colourways. The store's standard three are brand tokens; an admin can add
 * more to a product, named by them and swatched with the hex they pick.
 */

export const STANDARD_COLOURS = [
  { id: "black", name: "Black", swatch: "bg-ink" },
  { id: "oxblood", name: "Oxblood", swatch: "bg-ember" },
  { id: "white", name: "White", swatch: "bg-white" },
] as const satisfies readonly ProductColour[];

export const STANDARD_COLOUR_IDS: readonly string[] = STANDARD_COLOURS.map((c) => c.id);

/** Custom colour ids: `cus_` and a random tail, so renaming never touches stock keys. */
export const CUSTOM_COLOUR_ID = /^cus_[a-z0-9]{4,}$/;

export const MAX_CUSTOM_COLOURS = 12;

export function newCustomColourId() {
  return `cus_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Whether a colour name is already used, ignoring case and spacing. */
export function colourNameTaken(name: string, others: readonly { name: string }[]) {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return others.some((o) => o.name.trim().toLowerCase().replace(/\s+/g, " ") === key);
}
