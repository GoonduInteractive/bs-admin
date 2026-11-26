import "server-only";
import { notFound } from "next/navigation";

/**
 * Whether the admin's Hedera screens run, and on what.
 *
 * THE HEDERA APIS DON'T EXIST YET (Sophia's "Hedera on the Website (v2
 * Scope)", 2026-11-09; nothing in `api.txt` as of 2026-11-20), so the screens
 * run on the in-memory mock (`lib/api/hedera-mock.ts`) behind `HEDERA_MOCK=1`,
 * set in a developer's `.env.local` only. Unset (production, and any branch
 * this merges into), the section is OFF: no Hedera group in the sidebar, every
 * `/hedera` address is the dashboard's 404, the layout raises no Hedera
 * notices and the tournament form has no prize-type fields. Mock HBAR can't
 * be approved on the real admin.
 *
 * The same switch as the website's `NEXT_PUBLIC_HEDERA_MOCK`, without the
 * prefix: the admin reads it on the server only, and client components get
 * what they need as props. When the endpoints land this gains "live", and the
 * functions in `lib/api/hedera.ts` stop calling the mock.
 */
export type HederaMode = "mock" | "off";

export const HEDERA_MODE: HederaMode = process.env.HEDERA_MOCK === "1" ? "mock" : "off";

export const HEDERA_ON = HEDERA_MODE !== "off";

/**
 * The first line of every Hedera page. The section's layout 404s too, but a
 * layout and its page render side by side, so without this an off page would
 * still read the mock (and stream it) behind the 404.
 */
export function requireHedera(): void {
  if (!HEDERA_ON) notFound();
}
