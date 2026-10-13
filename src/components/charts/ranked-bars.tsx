"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { ShareSlice } from "@/types";
import { FORMAT, type Unit } from "./units";

/**
 * Ranked horizontal bars, one series. Bars cap at 20px with a rounded data
 * end and a square baseline; each value sits at its tip, so there is no value
 * axis to read.
 */

const config = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;

export function RankedBars({
  data,
  unit = "count",
  color = "var(--chart-1)",
}: {
  data: ShareSlice[];
  unit?: Unit;
  color?: string;
}) {
  const format = FORMAT[unit];
  const height = Math.max(160, data.length * 40);

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={130}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-paper)" }}
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
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            className="fill-foreground tabular"
            fontSize={12}
            formatter={(v) => format(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
