import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONE: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-slate-soft text-slate", dot: "bg-slate" },
  success: { pill: "bg-moss-soft text-moss", dot: "bg-moss" },
  warning: { pill: "bg-amber-soft text-amber-ink", dot: "bg-amber" },
  danger: { pill: "bg-flare-soft text-flare", dot: "bg-flare" },
  info: { pill: "bg-sky-soft text-sky-ink", dot: "bg-sky" },
  brand: { pill: "bg-brand-soft text-brand-ink", dot: "bg-signal" },
};

/**
 * A status pill. Colour never carries the meaning alone - the label is always
 * printed, and the dot is decoration.
 */
export function StatusBadge({ label, tone, hint, className }: { label: string; tone: Tone; hint?: string; className?: string }) {
  const t = TONE[tone];
  return (
    <span
      // `hint`: what the label means, on hover, where a word alone could be read wrongly.
      title={hint}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        t.pill,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />
      {label}
    </span>
  );
}
