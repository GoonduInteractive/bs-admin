import "server-only";
import type { DashboardSummary, RegionId, ShareSlice, TimeSeriesPoint, Transaction } from "@/types";
import { REGIONS } from "@/lib/mock/regions";
import { regionName, regionNames } from "@/lib/regions";
import { ORDERS } from "@/lib/mock/orders";
import { PLAYERS } from "@/lib/mock/players";
import { DAY, MOCK_NOW } from "@/lib/mock/random";
import { TOURNAMENTS } from "@/lib/mock/tournaments";
import { TRANSACTIONS } from "@/lib/mock/transactions";
import { mockDelay } from "./client";

/**
 * Dashboard aggregates, all scoped to one range so every figure on the page
 * describes the same window. MOCK: computed from the fixtures, so the overview
 * agrees with the list pages. A real backend would serve these pre-aggregated
 * (`GET /dashboard/summary?range=30`); the return types are the contract.
 */

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(value: unknown): RangeDays {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

const isRevenue = (t: Transaction) => t.direction === "in" && t.status === "successful";

function inWindow(iso: string, fromDaysAgo: number, toDaysAgo = 0) {
  const t = new Date(iso).getTime();
  return t > MOCK_NOW - fromDaysAgo * DAY && t <= MOCK_NOW - toDaysAgo * DAY;
}

function change(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const sumRevenue = (from: number, to = 0) =>
  TRANSACTIONS.filter((t) => isRevenue(t) && inWindow(t.createdAt, from, to)).reduce((s, t) => s + t.amount, 0);

/** Headline figures for the range, each against the range before it. */
export async function getSummary(range: RangeDays): Promise<DashboardSummary> {
  await mockDelay();
  const revenueNow = sumRevenue(range);
  const revenuePrev = sumRevenue(range * 2, range);
  const ordersNow = ORDERS.filter((o) => inWindow(o.placedAt, range)).length;
  const ordersPrev = ORDERS.filter((o) => inWindow(o.placedAt, range * 2, range)).length;
  const joinedBefore = PLAYERS.filter((p) => new Date(p.joinedAt).getTime() <= MOCK_NOW - range * DAY).length;
  const active = TOURNAMENTS.filter((t) => t.status === "active" || t.status === "registrationOpen").length;

  return {
    revenue: { value: revenueNow, change: change(revenueNow, revenuePrev) },
    orders: { value: ordersNow, change: change(ordersNow, ordersPrev) },
    players: { value: PLAYERS.length, change: change(PLAYERS.length, joinedBefore) },
    activeTournaments: { value: active, change: 0 },
  };
}

/** Daily revenue across the range, oldest first. */
export async function getRevenueSeries(range: RangeDays): Promise<TimeSeriesPoint[]> {
  await mockDelay(0);
  return Array.from({ length: range }, (_, i) => {
    const ago = range - 1 - i;
    const date = new Date(MOCK_NOW - ago * DAY);
    return {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Africa/Lagos" }).format(date),
      value: sumRevenue(ago + 1, ago),
    };
  });
}

/** Where the money came from in the range. */
export async function getRevenueByStream(range: RangeDays): Promise<ShareSlice[]> {
  await mockDelay(0);
  const sum = (type: Transaction["type"]) =>
    TRANSACTIONS.filter((t) => isRevenue(t) && t.type === type && inWindow(t.createdAt, range)).reduce(
      (s, t) => s + t.amount,
      0,
    );
  return [
    { key: "merch", label: "Merch", value: sum("merch") },
    { key: "comic", label: "Comics", value: sum("comic") },
  ];
}

/** Units sold per item in the range, cancelled orders excluded, most first. */
export async function getUnitsByItem(range: RangeDays): Promise<ShareSlice[]> {
  await mockDelay(0);
  const units = new Map<string, ShareSlice>();
  for (const order of ORDERS) {
    if (order.status === "cancelled" || !inWindow(order.placedAt, range)) continue;
    for (const line of order.lines) {
      const slice = units.get(line.refId) ?? { key: line.refId, label: line.name, value: 0 };
      slice.value += line.quantity;
      units.set(line.refId, slice);
    }
  }
  return [...units.values()].sort((a, b) => b.value - a.value);
}

/** Every registered player by region, named from the Regions list. Not range-scoped: it is a head count. */
export async function getPlayersByRegion(): Promise<ShareSlice[]> {
  await mockDelay(0);
  const counts = new Map<RegionId, number>();
  const names = regionNames(REGIONS);
  for (const p of PLAYERS) counts.set(p.region, (counts.get(p.region) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, value]) => ({ key, label: regionName(key, names), value }))
    .sort((a, b) => b.value - a.value);
}
