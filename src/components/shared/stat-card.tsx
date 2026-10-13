import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatChange } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "success" | "danger";

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-amber-ink",
  success: "text-moss",
  danger: "text-flare",
};

/**
 * A KPI tile: label, one big number, and optionally the change against the
 * previous period. The number is the chart here - no plot needed.
 */
export function StatCard({
  label,
  value,
  change,
  changeLabel = "vs last 30 days",
  tone = "default",
  icon: Icon,
  footer,
}: {
  label: string;
  value: ReactNode;
  change?: number;
  changeLabel?: string;
  tone?: Tone;
  icon?: LucideIcon;
  footer?: ReactNode;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/8">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-paper text-muted-foreground">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-3xl leading-none font-semibold tracking-tight", TONE[tone])}>{value}</p>
      {change !== undefined && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-moss" : "text-flare")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatChange(change)}
          </span>
          {changeLabel}
        </p>
      )}
      {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
