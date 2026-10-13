"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatNaira } from "@/lib/format";
import { toLagosInput } from "@/lib/lagos-time";
import { freeShippingSchema, type FreeShippingInput } from "@/lib/schemas";
import { promoPhase } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import type { FreeShippingPromo } from "@/types";
import { saveFreeShippingAction } from "./actions";

/**
 * Free shipping for a promotional campaign: on or off, the items total an
 * order needs, and optional dates it runs between. The checkout drops the
 * shipping charge for any order that qualifies while it's live.
 */
export function FreeShippingForm({ promo }: { promo: FreeShippingPromo }) {
  const form = useForm<FreeShippingInput>({
    resolver: zodResolver(freeShippingSchema),
    defaultValues: {
      enabled: promo.enabled,
      minimumOrder: String(promo.minimumOrder),
      startsAt: toLagosInput(promo.startsAt),
      endsAt: toLagosInput(promo.endsAt),
    },
  });
  const { errors } = form.formState;
  const enabled = useWatch({ control: form.control, name: "enabled" });
  const [saving, startSave] = useTransition();

  const onSubmit = form.handleSubmit((values) =>
    startSave(async () => {
      const res = await saveFreeShippingAction(values);
      if (res?.error) toast.error(res.error);
      else toast.success(values.enabled ? "Free shipping promotion saved" : "Free shipping switched off");
    }),
  );

  // What's saved, not what's being typed: the status reads the stored promotion.
  const phase = promoPhase(promo);
  const status = {
    off: "Off. Every order pays its place's shipping price.",
    scheduled: `Starts ${promo.startsAt ? formatDateTime(promo.startsAt) : ""}. Orders of ${formatNaira(promo.minimumOrder)} or more will ship free.`,
    live:
      (promo.minimumOrder === 0 ? "Live: every order ships free" : `Live: orders of ${formatNaira(promo.minimumOrder)} or more ship free`) +
      (promo.endsAt ? ` until ${formatDateTime(promo.endsAt)}.` : ", until it's switched off."),
    ended: `Ended ${promo.endsAt ? formatDateTime(promo.endsAt) : ""}. Every order pays its place's shipping price again.`,
  }[phase];

  return (
    <form onSubmit={onSubmit} noValidate>
      <Panel
        title="Free shipping promotion"
        description="For campaigns: while it runs, any order over the minimum ships free by Home Delivery or Pickup, anywhere in Nigeria."
      >
        <FieldGroup>
          <p
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm",
              phase === "live" ? "bg-moss-soft text-moss" : phase === "scheduled" ? "bg-amber-soft text-amber-ink" : "bg-paper text-foreground",
            )}
          >
            {status}
          </p>

          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => <Switch id="fs-enabled" checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel htmlFor="fs-enabled" className="font-normal">
              Run free shipping
            </FieldLabel>
          </Field>

          {/* Stays mounted when off, so the threshold and dates survive switching it off and on. */}
          <div className={cn("grid gap-4 sm:grid-cols-3", !enabled && "hidden")}>
            <Field data-invalid={!!errors.minimumOrder}>
              <FieldLabel htmlFor="fs-min">Minimum order (₦)</FieldLabel>
              <Input id="fs-min" type="number" min={0} step={500} inputMode="numeric" className="h-10" aria-invalid={!!errors.minimumOrder} {...form.register("minimumOrder")} />
              <FieldDescription>The items total, before points. 0 for every order.</FieldDescription>
              <FieldError errors={[errors.minimumOrder]} />
            </Field>
            <Field data-invalid={!!errors.startsAt}>
              <FieldLabel htmlFor="fs-start">Starts</FieldLabel>
              <Input id="fs-start" type="datetime-local" className="h-10" {...form.register("startsAt")} />
              <FieldDescription>Lagos time. Blank starts it now.</FieldDescription>
              <FieldError errors={[errors.startsAt]} />
            </Field>
            <Field data-invalid={!!errors.endsAt}>
              <FieldLabel htmlFor="fs-end">Ends</FieldLabel>
              <Input id="fs-end" type="datetime-local" className="h-10" aria-invalid={!!errors.endsAt} {...form.register("endsAt")} />
              <FieldDescription>Blank runs it until switched off.</FieldDescription>
              <FieldError errors={[errors.endsAt]} />
            </Field>
          </div>

          <div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save promotion
            </Button>
          </div>
        </FieldGroup>
      </Panel>
    </form>
  );
}
