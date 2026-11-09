import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getFreeShipping, getShippingRates, getShippingStats } from "@/lib/api/merch";
import { formatCount, formatNaira } from "@/lib/format";
import { STATES, lgasOf, overrideCount } from "@/lib/shipping";
import { FreeShippingForm } from "./free-shipping-form";
import { ShippingTable, type StateRow } from "./shipping-table";

export const metadata: Metadata = { title: "Shipping" };

/**
 * What shipping costs, by where it's going: a Home Delivery and a Pickup price
 * per state, any local government priced on its own, and a free shipping
 * promotion for campaigns. The checkout charges
 * from here once the store reads it.
 */
export default async function ShippingPage() {
  const [rates, promo, stats] = await Promise.all([getShippingRates(), getFreeShipping(), getShippingStats()]);
  const phase = stats.promo;
  const lgaList = (state: string) => lgasOf(state).map((l) => ({ id: l.id, name: l.name }));
  // Every state from `nigeria-lga-data` gets a row, priced or not, so an admin can price one the backend
  // doesn't have yet. A priced state whose name the list doesn't know is kept too, at the end.
  const rows: StateRow[] = [
    ...STATES.map((state): StateRow => {
      const s = rates.find((r) => r.state === state);
      return s
        ? { ...s, lgaList: lgaList(state), overrides: overrideCount(s) }
        : { state, homeDelivery: null, pickup: null, lgas: {}, updatedAt: null, lgaList: lgaList(state), overrides: 0 };
    }),
    ...rates.filter((s) => !STATES.includes(s.state)).map((s) => ({ ...s, lgaList: lgaList(s.state), overrides: overrideCount(s) })),
  ];
  const overrides = rows.reduce((n, r) => n + r.overrides, 0);
  /** "₦2,500 – ₦5,500", or a dash before anything is priced. */
  const range = (r: { min: number; max: number } | null) => (r ? `${formatNaira(r.min)} – ${formatNaira(r.max)}` : "—");

  return (
    <>
      <PageHeader
        title="Shipping"
        description="What delivery costs, by state and local government. Home Delivery goes to the customer's door; Pickup goes to a transport company's collection centre in their local government."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="States priced"
          value={`${formatCount(stats.pricedStates)} of ${formatCount(STATES.length)}`}
          footer={`36 states and the FCT · ${formatCount(overrides)} local governments priced on their own`}
        />
        <StatCard label="Home Delivery" value={range(stats.homeDelivery)} footer="Cheapest to dearest, local governments included" />
        <StatCard label="Pickup" value={range(stats.pickup)} footer="Cheapest to dearest, local governments included" />
        <StatCard
          label="Free shipping"
          value={{ off: "Off", scheduled: "Scheduled", live: "Live", ended: "Ended" }[phase]}
          footer={phase === "live" || phase === "scheduled" ? `On orders of ${formatNaira(promo.minimumOrder)} or more` : "No promotion running"}
        />
      </div>

      <FreeShippingForm promo={promo} />

      <SectionHeader title="Prices by state" />
      <ShippingTable rows={rows} />
    </>
  );
}
