"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { chapterPricingSchema, type ChapterPricingInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * Scheduling or publishing a chapter that has no price stops here: the admin
 * sets how readers buy it - online (paid, or free by choice) and/or in print -
 * and only then does it schedule. There is no "schedule anyway": a chapter is
 * never released without a price. Cancel goes back to the form, unsaved.
 */
export function PricePrompt({
  open,
  action,
  releaseDate,
  defaults,
  onCancel,
  onSave,
}: {
  open: boolean;
  /** What the admin clicked: "Schedule" or "Publish". */
  action: "Schedule" | "Publish";
  /** When it releases, for the sentence; absent when publishing now. */
  releaseDate: string | null;
  /** Prices it had before, if it was ever priced; otherwise blank. */
  defaults: ChapterPricingInput["formats"];
  onCancel: () => void;
  onSave: (pricing: ChapterPricingInput) => void;
}) {
  const form = useForm<ChapterPricingInput>({
    resolver: zodResolver(chapterPricingSchema),
    values: { formats: defaults },
  });
  const { errors } = form.formState;
  const [online, free, physical] = useWatch({
    control: form.control,
    name: ["formats.online.enabled", "formats.online.free", "formats.physical.enabled"],
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="sm:max-w-lg">
        {/* Its own form, portalled out of the chapter form: stop the submit
            bubbling through React to the chapter form behind it. */}
        <form
          noValidate
          onSubmit={(e) => {
            e.stopPropagation();
            void form.handleSubmit(onSave)(e);
          }}
          className="flex flex-col gap-5"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Add a price to {action.toLowerCase()}</AlertDialogTitle>
            <AlertDialogDescription>
              {releaseDate ? `This chapter releases on ${releaseDate}.` : "This chapter goes live now."} Set how readers buy it
              first: it goes on sale the moment it releases.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FieldGroup className="gap-4">
            <FormatBox
              label="Online"
              body="Read in the Beyond Service reader."
              on={online}
              toggle={<Controller control={form.control} name="formats.online.enabled" render={({ field }) => <Switch id="pp-online" checked={field.value} onCheckedChange={field.onChange} />} />}
              switchId="pp-online"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <Field data-invalid={!!errors.formats?.online?.price && !free}>
                  <FieldLabel htmlFor="pp-online-price">Price (₦)</FieldLabel>
                  <Input
                    id="pp-online-price"
                    type="number"
                    min={1}
                    step={500}
                    inputMode="numeric"
                    autoFocus
                    disabled={free}
                    placeholder={free ? "Free" : "e.g. 3000"}
                    className="h-10"
                    aria-invalid={!!errors.formats?.online?.price && !free}
                    {...form.register("formats.online.price")}
                  />
                  {!free && <FieldError errors={[errors.formats?.online?.price]} />}
                </Field>
                <Field orientation="horizontal" className="sm:pt-7.5">
                  <Controller
                    control={form.control}
                    name="formats.online.free"
                    render={({ field }) => <Switch id="pp-free" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                  <FieldLabel htmlFor="pp-free" className="font-normal whitespace-nowrap">
                    Free to read
                  </FieldLabel>
                </Field>
              </div>
            </FormatBox>

            <FormatBox
              label="Print"
              body="The printed book, shipped with store orders."
              on={physical}
              toggle={<Controller control={form.control} name="formats.physical.enabled" render={({ field }) => <Switch id="pp-print" checked={field.value} onCheckedChange={field.onChange} />} />}
              switchId="pp-print"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={!!errors.formats?.physical?.price}>
                  <FieldLabel htmlFor="pp-print-price">Price (₦)</FieldLabel>
                  <Input id="pp-print-price" type="number" min={500} step={500} inputMode="numeric" className="h-10" aria-invalid={!!errors.formats?.physical?.price} {...form.register("formats.physical.price")} />
                  <FieldError errors={[errors.formats?.physical?.price]} />
                </Field>
                <Field data-invalid={!!errors.formats?.physical?.stock}>
                  <FieldLabel htmlFor="pp-print-stock">Copies in stock</FieldLabel>
                  <Input id="pp-print-stock" type="number" min={0} inputMode="numeric" className="h-10" aria-invalid={!!errors.formats?.physical?.stock} {...form.register("formats.physical.stock")} />
                  <FieldError errors={[errors.formats?.physical?.stock]} />
                </Field>
              </div>
            </FormatBox>

            <FieldError errors={[errors.formats as { message?: string } | undefined]} />
            <FieldDescription>You can change prices later in Products.</FieldDescription>
          </FieldGroup>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit">Save price &amp; {action.toLowerCase()}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One way to buy it: a switch, and its fields while it's on. */
function FormatBox({
  label,
  body,
  on,
  toggle,
  switchId,
  children,
}: {
  label: string;
  body: string;
  on: boolean;
  toggle: React.ReactNode;
  switchId: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-3.5 transition-colors", on && "border-primary/40 bg-paper/50")}>
      <div className="flex items-start gap-3">
        {toggle}
        <label htmlFor={switchId} className="flex-1 cursor-pointer">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{body}</span>
        </label>
      </div>
      {/* Stays mounted when off, so a typed price survives switching it off and on. */}
      <div className={cn("mt-3", !on && "hidden")}>{children}</div>
    </div>
  );
}
