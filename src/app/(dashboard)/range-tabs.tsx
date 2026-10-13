import Link from "next/link";
import { RANGES, type RangeDays } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

/** The dashboard's one date control. It scopes every figure below it. */
export function RangeTabs({ value }: { value: RangeDays }) {
  return (
    <nav aria-label="Date range" className="inline-flex h-10 items-center rounded-lg bg-card p-1 ring-1 ring-foreground/8">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={r === 30 ? "/" : `/?range=${r}`}
          scroll={false}
          aria-current={r === value ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            r === value && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          Last {r} days
        </Link>
      ))}
    </nav>
  );
}
