"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatNaira, formatNairaCompact } from "@/lib/format";
import type { TimeSeriesPoint } from "@/types";

/**
 * Daily revenue. One series, so no legend - the card title names it.
 * Line 2px, a 10% wash under it, hairline solid grid, crosshair tooltip.
 */

/**
 * Axis text takes the theme's muted ink explicitly. Left alone, Recharts paints
 * ticks #666, which all but disappears on the dark card.
 */
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

const config = { value: { label: "Revenue", color: "var(--chart-1)" } } satisfies ChartConfig;

function Readout({ active, payload }: { active?: boolean; payload?: { payload: TimeSeriesPoint }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="text-muted-foreground">{point.label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-1" />
        {formatNaira(point.value)}
      </p>
    </div>
  );
}

export function RevenueChart({ data }: { data: TimeSeriesPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenue-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-mist)" strokeOpacity={0.7} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={28} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => formatNairaCompact(v)}
          className="tabular"
        />
        <ChartTooltip cursor={{ stroke: "var(--color-slate)", strokeWidth: 1 }} content={<Readout />} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#revenue-wash)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
