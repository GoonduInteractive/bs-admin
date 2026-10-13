import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getFreeShipping, getShippingRates } from "@/lib/api/merch";
import { formatCount, formatNaira } from "@/lib/format";
import { lgasOf, overrideCount, promoPhase } from "@/lib/shipping";
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
  const [rates, promo] = await Promise.all([getShippingRates(), getFreeShipping()]);
  const phase = promoPhase(promo);
  const rows: StateRow[] = rates.map((s) => ({
    ...s,
    lgaList: lgasOf(s.state).map((l) => ({ id: l.id, name: l.name })),
    overrides: overrideCount(s),
  }));
  const homes = rates.map((s) => s.homeDelivery);
  const pickups = rates.map((s) => s.pickup);
  const overrides = rows.reduce((n, r) => n + r.overrides, 0);

  return (
    <>
      <PageHeader
        title="Shipping"
        description="What delivery costs, by state and local government. Home Delivery goes to the customer's door; Pickup goes to a transport company's collection centre in their local government."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="States priced" value={formatCount(rates.length)} footer={`36 states and the FCT · ${formatCount(overrides)} local governments priced on their own`} />
        <StatCard label="Home Delivery" value={`${formatNaira(Math.min(...homes))} – ${formatNaira(Math.max(...homes))}`} footer="Cheapest to dearest state" />
        <StatCard label="Pickup" value={`${formatNaira(Math.min(...pickups))} – ${formatNaira(Math.max(...pickups))}`} footer="Cheapest to dearest state" />
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
