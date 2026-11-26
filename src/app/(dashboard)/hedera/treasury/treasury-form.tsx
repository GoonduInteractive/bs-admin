"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { treasurySettingsSchema, type TreasurySettingsInput } from "@/lib/schemas";
import type { TreasurySettings } from "@/types/hedera";
import { saveTreasurySettingsAction } from "../actions";

/** What an admin sets: when the balance warns, which prizes need an identity check, and the HBAR checkout discount. */
export function TreasuryForm({ settings }: { settings: TreasurySettings }) {
  const [saving, start] = useTransition();
  const form = useForm<TreasurySettingsInput>({ resolver: zodResolver(treasurySettingsSchema), defaultValues: settings });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await saveTreasurySettingsAction(values);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Treasury settings saved");
        form.reset(values);
      }
    }),
  );

  return (
    <Panel title="Settings">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.alertBelow}>
            <FieldLabel htmlFor="alertBelow">Warn below (HBAR)</FieldLabel>
            <Input id="alertBelow" type="number" inputMode="decimal" min={0} step="any" className="h-10 tabular" aria-invalid={!!errors.alertBelow} {...form.register("alertBelow")} />
            <FieldDescription>Under this, every admin sees a warning in the bell. Leave room for the prizes waiting to be approved.</FieldDescription>
            <FieldError errors={[errors.alertBelow]} />
          </Field>
          <Field data-invalid={!!errors.identityThreshold}>
            <FieldLabel htmlFor="identityThreshold">Identity check above (HBAR)</FieldLabel>
            <Input
              id="identityThreshold"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className="h-10 tabular"
              aria-invalid={!!errors.identityThreshold}
              {...form.register("identityThreshold")}
            />
            <FieldDescription>
              A prize over this waits for the winner&apos;s name, date of birth and ID. Changing it applies to every prize not yet sent. A check already verified stays
              verified.
            </FieldDescription>
            <FieldError errors={[errors.identityThreshold]} />
          </Field>
          <Field data-invalid={!!errors.hbarDiscountPct}>
            <FieldLabel htmlFor="hbarDiscountPct">HBAR checkout discount (%)</FieldLabel>
            <Input
              id="hbarDiscountPct"
              type="number"
              inputMode="decimal"
              min={0}
              max={20}
              step="any"
              className="h-10 tabular"
              aria-invalid={!!errors.hbarDiscountPct}
              {...form.register("hbarDiscountPct")}
            />
            <FieldDescription>
              Off a merch order paid in HBAR rather than by card or bank, to get players using it. At 2.5%, a ₦20,000 order is ₦19,500 in HBAR. 0 turns it off.
            </FieldDescription>
            <FieldError errors={[errors.hbarDiscountPct]} />
          </Field>
          <Button type="submit" disabled={saving || !isDirty} className="self-start">
            {saving && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}
