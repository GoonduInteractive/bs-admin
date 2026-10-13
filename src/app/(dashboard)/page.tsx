import { ArrowUpRight, ShoppingBag, Trophy, Users, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RankedBars } from "@/components/charts/ranked-bars";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { ShareDonut } from "@/components/charts/share-donut";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getCurrentAdmin } from "@/lib/api/auth";
import { getRegions, getTournaments } from "@/lib/api/competition";
import { regionName, regionNames } from "@/lib/regions";
import {
  getPlayersByRegion,
  getRevenueByStream,
  getRevenueSeries,
  getSummary,
  getUnitsByItem,
  parseRange,
} from "@/lib/api/dashboard";
import { getOrders } from "@/lib/api/orders";
import { formatCount, formatDate, formatNaira, formatNairaCompact } from "@/lib/format";
import { ORDER_STATUS, TOURNAMENT_STATUS } from "@/lib/labels";
import { slotsFill, slotsLabel } from "@/lib/tournaments";
import { RangeTabs } from "./range-tabs";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", timeZone: "Africa/Lagos" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const range = parseRange((await searchParams).range);
  const [admin, summary, series, streams, units, regions, orders, tournaments, regionList] = await Promise.all([
    getCurrentAdmin(),
    getSummary(range),
    getRevenueSeries(range),
    getRevenueByStream(range),
    getUnitsByItem(range),
    getPlayersByRegion(),
    getOrders(),
    getTournaments(),
    getRegions(),
  ]);

  const period = `vs previous ${range} days`;
  const names = regionNames(regionList);
  const live = tournaments.filter((t) => t.status === "active" || t.status === "registrationOpen");
  const recent = orders.slice(0, 6);
  const total = series.reduce((s, p) => s + p.value, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${greeting()}, ${admin?.name.split(" ")[0] ?? "there"}. Here's how Beyond Service is doing.`}
        actions={<RangeTabs value={range} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatNairaCompact(summary.revenue.value)} change={summary.revenue.change} changeLabel={period} icon={Wallet} />
        <StatCard label="Orders" value={formatCount(summary.orders.value)} change={summary.orders.change} changeLabel={period} icon={ShoppingBag} />
        <StatCard label="Registered players" value={formatCount(summary.players.value)} change={summary.players.change} changeLabel={`joined in the last ${range} days`} icon={Users} />
        <StatCard
          label="Live tournaments"
          value={summary.activeTournaments.value}
          icon={Trophy}
          footer={`${tournaments.filter((t) => t.status === "registrationOpen").length} taking registrations`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Revenue"
          description="Successful payments per day, all streams"
          action={
            <div className="text-right">
              <p className="text-2xl leading-none font-semibold">{formatNaira(total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Last {range} days</p>
            </div>
          }
        >
          <RevenueChart data={series} />
        </Panel>

        <Panel title="Revenue by stream" description={`Where the money came from, last ${range} days`}>
          <ShareDonut data={streams} unit="naira" centerLabel="Total" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent orders"
          action={
            <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              View all <ArrowUpRight className="size-4" />
            </Link>
          }
          bodyClassName="px-2 pb-2 pt-3"
        >
          <ul className="divide-y">
            {recent.map((o) => {
              const s = ORDER_STATUS[o.status];
              const first = o.lines[0];
              return (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-paper">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-linen">
                      <Image src={first.image} alt="" fill sizes="44px" className="object-contain p-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {o.customer.name}
                        <span className="ml-2 font-normal text-muted-foreground">{o.reference}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {first.name}
                        {o.lines.length > 1 && ` + ${o.lines.length - 1} more`} · {formatDate(o.placedAt)}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <StatusBadge label={s.label} tone={s.tone} />
                    </span>
                    <span className="w-24 text-right text-sm font-medium tabular">{formatNaira(o.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Tournaments"
          description="Running now or taking registrations"
          action={
            <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              All <ArrowUpRight className="size-4" />
            </Link>
          }
        >
          <ul className="space-y-3">
            {live.map((t) => {
              const s = TOURNAMENT_STATUS[t.status];
              const fill = slotsFill(t);
              return (
                <li key={t.id}>
                  <Link href={`/tournaments/${t.slug}`} className="block rounded-lg border p-3.5 hover:bg-paper">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{t.name}</p>
                      <StatusBadge label={s.label} tone={s.tone} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {regionName(t.region, names)} · {formatNairaCompact(t.prizePool)} prize pool
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {fill === null ? (
                        <span className="flex-1 text-xs text-muted-foreground">Unlimited slots</span>
                      ) : (
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-soft">
                          <div className="h-full rounded-full bg-crimson" style={{ width: `${fill}%` }} />
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground tabular">{slotsLabel(t)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Units sold" description={`By item, last ${range} days, cancelled orders excluded`}>
          <RankedBars data={units} unit="count" />
        </Panel>
        <Panel title="Players by region" description="Every registered player, by league region">
          <RankedBars data={regions} unit="count" color="var(--chart-2)" />
        </Panel>
      </div>
    </>
  );
}
