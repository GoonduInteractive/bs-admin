import "server-only";
import { z } from "zod";

/**
 * A region's map pin from its name, so an admin doesn't type coordinates:
 * OpenStreetMap's Nominatim, searched within Nigeria. Free and keyless,
 * under a usage policy this keeps: called from the server, never the
 * browser; one search per lookup the admin asks for (leaving the name, or
 * Find pin), never per keystroke; at most one a second; a User-Agent naming
 * the app; answers cached per name. Results credit OpenStreetMap.
 *
 * NOT `nigeria-lga-data`'s coordinates, though the admin has the package:
 * checked 2026-11-16 against known places, its "approximate centroids" are
 * 70 to 190 km off (Ikeja at 6.45, 2.69; Lagos Island in the sea). Its names
 * are fine and Shipping keeps using them.
 *
 * Coordinates are rounded to 4 decimals (about 11m), plenty for a region pin.
 */

export type FoundPin = {
  lat: number;
  lng: number;
  /** What was found, e.g. "Rumuokoro, Obio/Akpor, Rivers, Nigeria". */
  label: string;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BeyondServiceAdmin/1.0 (+https://github.com/GoonduInteractive/bs-admin)";
const reply = z.array(z.object({ lat: z.coerce.number(), lon: z.coerce.number(), display_name: z.string() }));

const round = (n: number) => Math.round(n * 10_000) / 10_000;
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/** "Lagos, Lagos Island, Lagos, 100242, Nigeria" without the postcode. */
const tidy = (label: string) =>
  label
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d+$/.test(part))
    .join(", ");

/** Answers for the life of the server, found or not: a name's place doesn't move. */
const cache = new Map<string, FoundPin | null>();
/** The policy's one search a second, across every admin on this server. */
let nextSlot = 0;

/** The pin for a region's name, or null when nothing by that name is found in Nigeria. Throws when OpenStreetMap can't be reached. */
export async function findRegionPin(name: string): Promise<FoundPin | null> {
  const k = key(name);
  if (cache.has(k)) return cache.get(k) ?? null;

  const wait = nextSlot - Date.now();
  nextSlot = Math.max(Date.now(), nextSlot) + 1000;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({ format: "jsonv2", countrycodes: "ng", limit: "1", q: name.trim() }).toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenStreetMap answered ${res.status}`);
  const [hit] = reply.parse(await res.json());
  const pin = hit ? { lat: round(hit.lat), lng: round(hit.lon), label: tidy(hit.display_name) } : null;
  cache.set(k, pin);
  return pin;
}
