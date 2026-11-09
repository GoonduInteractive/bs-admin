import "server-only";
import { z } from "zod";
import type { Dashboard, TournamentStatus } from "@/types";
import { regionNames } from "@/lib/regions";
import { apiFetch, fromMinor } from "./client";
import { getRegions } from "./competition";
import { API_ORDER_STATUS } from "./orders";

/**
 * The dashboard, all scoped to one range so every figure on the page describes
 * the same window.
 *
 * `GET /v1/admin/dashboard?range=7d|30d|90d` serves it pre-aggregated in one
 * call.
 */

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(value: unknown): RangeDays {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

/** "Oct 28", or a dash for a date that can't be read. */
const dayLabel = (date: Date | string) =>
  Number.isNaN(new Date(date).getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Africa/Lagos" }).format(new Date(date));

const API_TOURNAMENT_STATUS = {
  draft: "draft",
  coming_soon: "comingSoon",
  registration_open: "registrationOpen",
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
} as const satisfies Record<string, TournamentStatus>;

const STREAM_LABEL: Record<string, string> = { tournaments: "Tournaments", comics: "Comics", merch: "Merch", other: "Other" };

const card = z.object({ total: z.number().optional(), total_minor: z.number().optional(), change_pct: z.number().nullish() });

const apiDashboard = z.object({
  cards: z.object({
    revenue: card,
    orders: card,
    players: card.extend({ new_in_range: z.number().optional() }),
    live_tournaments: z.object({ active: z.number(), taking_registrations: z.number() }),
  }),
  revenue_series: z.array(z.object({ date: z.string(), total_minor: z.number() })),
  revenue_by_stream: z.object({ streams: z.array(z.object({ key: z.string(), total_minor: z.number() })) }),
  recent_orders: z.array(
    z.object({
      id: z.string(),
      order_number: z.string(),
      customer: z.string(),
      cover_image_url: z.string().nullish(),
      summary: z.string(),
      status: z.enum(Object.keys(API_ORDER_STATUS) as [keyof typeof API_ORDER_STATUS]),
      total_minor: z.number(),
      created_at: z.string(),
    }),
  ),
  tournaments: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(Object.keys(API_TOURNAMENT_STATUS) as [keyof typeof API_TOURNAMENT_STATUS]),
      region: z.string(),
      prize_pool_minor: z.number(),
      entries: z.number(),
      player_slots: z.number().nullable(),
    }),
  ),
  units_sold: z.array(z.object({ title: z.string(), units: z.number() })),
  players_by_region: z.array(z.object({ region: z.string(), players: z.number() })),
});

export async function getDashboard(range: RangeDays): Promise<Dashboard> {
  const [d, regions] = await Promise.all([apiFetch("/v1/admin/dashboard", apiDashboard, { query: { range: `${range}d` } }), getRegions()]);
  // The API names a tournament's region by id or by name; either reads as the name.
  const names = regionNames(regions);
  const place = (region: string) => names[region] ?? (region.toLowerCase() === "global" ? "Global" : region);
  const c = d.cards;

  return {
    summary: {
      revenue: { value: fromMinor(c.revenue.total_minor ?? 0), change: c.revenue.change_pct ?? null },
      orders: { value: c.orders.total ?? 0, change: c.orders.change_pct ?? null },
      players: { value: c.players.total ?? 0, change: c.players.change_pct ?? null },
      activeTournaments: { value: c.live_tournaments.active, change: null },
    },
    registrationsOpen: c.live_tournaments.taking_registrations,
    series: d.revenue_series.map((p) => ({ label: dayLabel(p.date), value: fromMinor(p.total_minor) })),
    streams: d.revenue_by_stream.streams.map((s) => ({ key: s.key, label: STREAM_LABEL[s.key] ?? s.key, value: fromMinor(s.total_minor) })),
    units: d.units_sold.map((u) => ({ key: u.title, label: u.title, value: u.units })),
    playersByRegion: d.players_by_region.map((r) => ({ key: r.region, label: place(r.region), value: r.players })),
    recentOrders: d.recent_orders.map((o) => ({
      id: o.id,
      reference: o.order_number,
      customer: o.customer,
      ...(o.cover_image_url && { image: o.cover_image_url }),
      summary: o.summary,
      status: API_ORDER_STATUS[o.status],
      total: fromMinor(o.total_minor),
      placedAt: o.created_at,
    })),
    tournaments: d.tournaments.filter((t) => t.status === "active" || t.status === "registration_open").map((t) => ({
      id: t.id,
      name: t.title,
      status: API_TOURNAMENT_STATUS[t.status],
      region: place(t.region),
      prizePool: fromMinor(t.prize_pool_minor),
      slots: { taken: t.entries, total: t.player_slots },
    })),
  };
}
