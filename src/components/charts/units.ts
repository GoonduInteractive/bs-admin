import { formatCount, formatNaira } from "@/lib/format";

/** How a chart prints its values. A key rather than a function, so server pages can pass it. */
export type Unit = "naira" | "count";

export const FORMAT: Record<Unit, (n: number) => string> = {
  naira: formatNaira,
  count: formatCount,
};
