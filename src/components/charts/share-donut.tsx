"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { ShareSlice } from "@/types";
import { FORMAT, type Unit } from "./units";

/**
 * A part-to-whole donut for a handful of slices (the palette is validated for
 * four, in this order). Slices are split by a 2px surface gap, and the legend
 * beside it prints each value and share, so identity never rests on colour
 * alone and the lighter slots are always labelled.
 */

const SLOTS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function ShareDonut({
  data,
  unit,
  centerLabel,
}: {
  data: ShareSlice[];
  unit: Unit;
  centerLabel: string;
}) {
  const format = FORMAT[unit];
  const slices = data.slice(0, SLOTS.length);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const config = Object.fromEntries(
    slices.map((d, i) => [d.key, { label: d.label, color: SLOTS[i] }]),
  ) satisfies ChartConfig;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative size-48 shrink-0">
        <ChartContainer config={config} className="aspect-square size-48">
          <PieChart>
            <ChartTooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as ShareSlice | undefined;
                if (!active || !d) return null;
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
                    <p className="text-muted-foreground">{d.label}</p>
                    <p className="mt-0.5 text-sm font-semibold">{format(d.value)}</p>
                  </div>
                );
              }}
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={92}
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {slices.map((d, i) => (
                <Cell key={d.key} fill={SLOTS[i]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg leading-none font-semibold">{format(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-3">
        {slices.map((d, i) => (
          <li key={d.key} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: SLOTS[i] }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-medium tabular">{format(d.value)}</span>
            <span className="w-11 text-right text-xs text-muted-foreground tabular">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
