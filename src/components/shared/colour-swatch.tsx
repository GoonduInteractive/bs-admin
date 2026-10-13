import { cn } from "@/lib/utils";
import type { ProductColour } from "@/types";

/** A colourway's dot: its brand token, or the hex an admin picked. */
export function ColourSwatch({ colour, className }: { colour: Pick<ProductColour, "swatch" | "hex">; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/30", colour.swatch, className)}
      style={colour.hex ? { backgroundColor: colour.hex } : undefined}
    />
  );
}
