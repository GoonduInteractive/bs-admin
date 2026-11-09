"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, Truck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch, type DefaultValues } from "react-hook-form";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCount, formatDate, formatNaira } from "@/lib/format";
import { stateShippingSchema, type StateShippingInput } from "@/lib/schemas";
import type { StateShipping } from "@/types";
import { saveStateShippingAction } from "./actions";

/**
 * A state's prices, with its local governments listed for the editor. Every
 * state has a row; one the backend has no prices for yet has `null` prices
 * and no `updatedAt`, and saving it creates them.
 */
export type StateRow = Omit<StateShipping, "homeDelivery" | "pickup" | "updatedAt"> & {
  homeDelivery: number | null;
  pickup: number | null;
  updatedAt: string | null;
  lgaList: { id: string; name: string }[];
  overrides: number;
};

function toInput(row: StateRow): DefaultValues<StateShippingInput> {
  return {
    homeDelivery: row.homeDelivery ?? undefined,
    pickup: row.pickup ?? undefined,
    lgas: Object.fromEntries(
      row.lgaList.map((l) => [l.id, { homeDelivery: String(row.lgas[l.id]?.homeDelivery ?? ""), pickup: String(row.lgas[l.id]?.pickup ?? "") }]),
    ),
  };
}

/**
 * Edit one state: its two prices, then any local government that should cost
 * something else. A blank local price follows the state's, so changing the
 * state's price moves every local government that doesn't have its own.
 */
function EditSheet({ row, onClose }: { row: StateRow | null; onClose: () => void }) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">{row && <EditForm key={row.state} row={row} onDone={onClose} />}</SheetContent>
    </Sheet>
  );
}

function EditForm({ row, onDone }: { row: StateRow; onDone: () => void }) {
  const [saving, start] = useTransition();
  const [query, setQuery] = useState("");
  const form = useForm<StateShippingInput>({ resolver: zodResolver(stateShippingSchema), defaultValues: toInput(row) });
  const { errors } = form.formState;
  const [home, pickup] = useWatch({ control: form.control, name: ["homeDelivery", "pickup"] });
  const shown = row.lgaList.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase()));

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await saveStateShippingAction(row.state, values);
      if ("error" in res) return void toast.error(res.error);
      toast.success(`${row.state} shipping saved`);
      onDone();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b p-6">
        <SheetTitle className="text-lg">{row.state}</SheetTitle>
        <SheetDescription>{formatCount(row.lgaList.length)} local governments. Prices in naira.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.homeDelivery}>
            <FieldLabel htmlFor="ship-home">Home Delivery (₦)</FieldLabel>
            <Input id="ship-home" type="number" min={1} step={100} inputMode="numeric" className="h-10" aria-invalid={!!errors.homeDelivery} {...form.register("homeDelivery")} />
            <FieldDescription>To the customer&apos;s door.</FieldDescription>
            <FieldError errors={[errors.homeDelivery]} />
          </Field>
          <Field data-invalid={!!errors.pickup}>
            <FieldLabel htmlFor="ship-pickup">Pickup (₦)</FieldLabel>
            <Input id="ship-pickup" type="number" min={1} step={100} inputMode="numeric" className="h-10" aria-invalid={!!errors.pickup} {...form.register("pickup")} />
            <FieldDescription>To a collection centre in their local government.</FieldDescription>
            <FieldError errors={[errors.pickup]} />
          </Field>
        </FieldGroup>

        <div>
          <p className="text-sm font-medium">Local government prices</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Only where it costs something else. Blank uses the state&apos;s price above.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${row.state}'s local governments…`} className="h-10 pl-9" aria-label="Search local governments" />
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-paper text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Local government</th>
                  <th className="w-32 px-2 py-2.5 text-left font-medium">Home</th>
                  <th className="w-32 px-2 py-2.5 text-left font-medium">Pickup</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Every row stays registered while filtered out, so a search never drops a typed price. */}
                {row.lgaList.map((l) => {
                  const e = errors.lgas?.[l.id];
                  return (
                    <tr key={l.id} className={shown.includes(l) ? undefined : "hidden"}>
                      <td className="px-3 py-1.5">{l.name}</td>
                      {(["homeDelivery", "pickup"] as const).map((side) => (
                        <td key={side} className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            inputMode="numeric"
                            aria-label={`${l.name} ${side === "pickup" ? "pickup" : "home delivery"} price`}
                            aria-invalid={!!e?.[side]}
                            placeholder={formatCount(Number(side === "pickup" ? pickup : home) || 0)}
                            className="h-8 tabular placeholder:text-muted-foreground/60"
                            {...form.register(`lgas.${l.id}.${side}` as const)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No local government matches &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <FieldError className="mt-2" errors={Object.values(errors.lgas ?? {}).flatMap((e) => [e?.homeDelivery, e?.pickup]).filter(Boolean).slice(0, 1)} />
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Save {row.state}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function ShippingTable({ rows }: { rows: StateRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const open = rows.find((r) => r.state === editing) ?? null;

  const price = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">Not priced</span> : <span className="tabular">{formatNaira(n)}</span>;

  const columns: Column<StateRow>[] = [
    { id: "state", header: "State", cell: (r) => <span className="font-medium">{r.state}</span>, sortValue: (r) => r.state, csv: (r) => r.state },
    { id: "home", header: "Home Delivery", cell: (r) => price(r.homeDelivery), sortValue: (r) => r.homeDelivery ?? -1, csv: (r) => r.homeDelivery ?? "" },
    { id: "pickup", header: "Pickup", cell: (r) => price(r.pickup), sortValue: (r) => r.pickup ?? -1, csv: (r) => r.pickup ?? "" },
    {
      id: "local",
      header: "Local prices",
      cell: (r) =>
        r.homeDelivery === null ? (
          <span className="text-muted-foreground">—</span>
        ) : r.overrides ? (
          <span>
            {r.overrides} of {r.lgaList.length}
          </span>
        ) : (
          <span className="text-muted-foreground">State price everywhere</span>
        ),
      sortValue: (r) => r.overrides,
      csv: (r) => r.overrides,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (r) => <span className="text-muted-foreground">{r.updatedAt ? formatDate(r.updatedAt) : "—"}</span>,
      sortValue: (r) => r.updatedAt ?? "",
    },
    {
      id: "edit",
      header: <span className="sr-only">Edit</span>,
      cell: (r) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="bg-card" onClick={() => setEditing(r.state)}>
            {r.homeDelivery === null ? "Set prices" : "Edit prices"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.state}
        onRowClick={(r) => setEditing(r.state)}
        searchText={(r) => `${r.state} ${r.lgaList.map((l) => l.name).join(" ")}`}
        searchPlaceholder="Search a state or local government…"
        exportName="shipping-rates"
        exportTitle="Shipping rates"
        empty={{ icon: Truck, title: "No shipping prices", description: "Every state needs a Home Delivery and a Pickup price." }}
      />
      <EditSheet row={open} onClose={() => setEditing(null)} />
    </>
  );
}
