"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatNaira } from "@/lib/format";

import { toLagosInput } from "@/lib/lagos-time";
import { GLOBAL_REGION, regionName, regionNames } from "@/lib/regions";
import { tournamentSchema, type TournamentInput } from "@/lib/schemas";
import { DEFAULT_PRIZE_SPLIT, SPLIT_TOLERANCE, ordinal, prizeAmounts, splitTotal } from "@/lib/tournaments";
import { cn } from "@/lib/utils";
import type { Region, Tournament } from "@/types";
import { saveTournamentAction } from "./actions";

/** 100% over n positions, to two decimals; 1st place takes the leftover hundredths. */
function evenSplit(n: number): number[] {
  const each = Math.floor(10_000 / n) / 100;
  const split = Array.from({ length: n }, () => each);
  split[0] = Math.round((100 - each * (n - 1)) * 100) / 100;
  return split;
}

/** "60%", "33.34%". */
const formatPercent = (n: number) => `${Math.round(n * 100) / 100}%`;

const VISIBILITY = [
  { value: "draft", title: "Draft", body: "Hidden from players." },
  { value: "comingSoon", title: "Coming soon", body: "Announced on the Competition page, no sign-ups." },
  { value: "registrationOpen", title: "Registration open", body: "Players can join until registration closes." },
] as const;

function toInput(t?: Tournament): TournamentInput {
  const editable = t && ["draft", "comingSoon", "registrationOpen"].includes(t.status);
  return {
    name: t?.name ?? "",
    description: t?.description ?? "",
    region: t?.region ?? "",
    status: editable ? (t.status as TournamentInput["status"]) : "draft",
    startsAt: toLagosInput(t?.startsAt),
    endsAt: toLagosInput(t?.endsAt),
    registrationClosesAt: toLagosInput(t?.registrationClosesAt),
    prizePool: t?.prizePool ?? 250_000,
    prizeSplit: (t?.prizeSplit ?? DEFAULT_PRIZE_SPLIT).map((share) => ({ share })),
    unlimitedSlots: t ? t.slots.total === null : false,
    // Kept for switching Unlimited off again; ignored while it is on.
    slots: t?.slots.total ?? 32,
    inGameRewards: t?.inGameRewards ?? true,
    featured: t?.featured ?? false,
  };
}

export function TournamentForm({
  tournament,
  regions,
}: {
  tournament?: Tournament;
  /** The Regions list. Active ones are offered; an archived one only if this tournament already uses it. */
  regions: Region[];
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const form = useForm<TournamentInput>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: toInput(tournament),
  });
  const { errors } = form.formState;
  const names = regionNames(regions);
  const regionOptions = regions.filter((r) => r.status === "active" || r.id === tournament?.region);
  const [prizePool, prizeSplit, unlimitedSlots] = useWatch({
    control: form.control,
    name: ["prizePool", "prizeSplit", "unlimitedSlots"],
  });
  const { fields: prizeFields, append: appendPosition, remove: removePosition, replace: replaceSplit } = useFieldArray({
    control: form.control,
    name: "prizeSplit",
  });
  const shares = prizeSplit.map((p) => Number(p.share) || 0);
  const total = splitTotal(shares);
  const splitOff = Math.abs(total - 100) > SPLIT_TOLERANCE;
  const payouts = prizeAmounts(Number(prizePool) || 0, shares);
  // The whole split's error (total, too many positions) comes first, then the first bad share.
  const splitErrors = errors.prizeSplit;
  const splitError =
    (splitErrors?.message ? splitErrors : splitErrors?.root) ??
    (Array.isArray(splitErrors) ? splitErrors.find((e) => e?.share)?.share : undefined);
  const setSplit = (split: readonly number[]) => {
    replaceSplit(split.map((share) => ({ share })));
    if (form.formState.isSubmitted) form.trigger("prizeSplit");
  };
  const lifecycleLocked = tournament && !["draft", "comingSoon", "registrationOpen"].includes(tournament.status);

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await saveTournamentAction(tournament?.slug ?? null, values);
      if (res?.error) toast.error(res.error);
      else toast.success(tournament ? "Tournament saved" : "Tournament created");
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Details">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" className="h-10" placeholder="Lagos Ascendant League" aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
              <FieldDescription>Shown on the tournament card and its page.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.region}>
                <FieldLabel htmlFor="region">Region</FieldLabel>
                <Controller
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(String(v))}>
                      <SelectTrigger id="region" className="w-full data-[size=default]:h-10" aria-invalid={!!errors.region}>
                        <SelectValue placeholder="Pick a region">
                          {(id: string) => (id ? regionName(id, names) : "Pick a region")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GLOBAL_REGION}>Global: every region</SelectItem>
                        {regionOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                            {r.status === "archived" ? " (archived)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  From the{" "}
                  <Link href="/regions" className="font-medium text-signal hover:underline">
                    Regions
                  </Link>{" "}
                  list. Missing one? Add it there.
                </FieldDescription>
                <FieldError errors={[errors.region]} />
              </Field>
              <Field data-invalid={!!errors.slots && !unlimitedSlots}>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="slots">Player slots</FieldLabel>
                  <span className="flex items-center gap-2">
                    <Controller
                      control={form.control}
                      name="unlimitedSlots"
                      render={({ field }) => (
                        <Switch
                          id="unlimitedSlots"
                          size="sm"
                          checked={field.value}
                          onCheckedChange={(on) => {
                            field.onChange(on);
                            // Slots decide how many positions can be paid; re-check both once errors are showing.
                            if (form.formState.isSubmitted) form.trigger(["slots", "prizeSplit"]);
                          }}
                        />
                      )}
                    />
                    <FieldLabel htmlFor="unlimitedSlots" className="text-xs font-normal text-muted-foreground">
                      Unlimited
                    </FieldLabel>
                  </span>
                </div>
                {unlimitedSlots ? (
                  <p className="flex h-10 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">
                    No cap: anyone can register until it closes.
                  </p>
                ) : (
                  <Input
                    id="slots"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    step={1}
                    className="h-10"
                    aria-invalid={!!errors.slots}
                    {...form.register("slots")}
                  />
                )}
                <FieldDescription>
                  {unlimitedSlots
                    ? "Turn Unlimited off to set a cap."
                    : "An even number. Over 32 players play Qualifiers first; the top 32 go into the bracket."}
                </FieldDescription>
                {!unlimitedSlots && <FieldError errors={[errors.slots]} />}
              </Field>
            </div>
          </FieldGroup>
        </Panel>

        <Panel title="Schedule" description="All times are Lagos time (WAT).">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!errors.registrationClosesAt}>
              <FieldLabel htmlFor="registrationClosesAt">Registration closes</FieldLabel>
              <Input id="registrationClosesAt" type="datetime-local" className="h-10" aria-invalid={!!errors.registrationClosesAt} {...form.register("registrationClosesAt")} />
              <FieldError errors={[errors.registrationClosesAt]} />
            </Field>
            <Field data-invalid={!!errors.startsAt}>
              <FieldLabel htmlFor="startsAt">Starts</FieldLabel>
              <Input id="startsAt" type="datetime-local" className="h-10" aria-invalid={!!errors.startsAt} {...form.register("startsAt")} />
              <FieldError errors={[errors.startsAt]} />
            </Field>
            <Field data-invalid={!!errors.endsAt}>
              <FieldLabel htmlFor="endsAt">Ends</FieldLabel>
              <Input id="endsAt" type="datetime-local" className="h-10" aria-invalid={!!errors.endsAt} {...form.register("endsAt")} />
              <FieldError errors={[errors.endsAt]} />
            </Field>
          </div>
        </Panel>

        <Panel title="Money & rewards">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.prizePool}>
                <FieldLabel htmlFor="prizePool">Prize pool (₦)</FieldLabel>
                <Input id="prizePool" type="number" min={0} step={10000} className="h-10" aria-invalid={!!errors.prizePool} {...form.register("prizePool")} />
                <FieldError errors={[errors.prizePool]} />
              </Field>
              {/* No entry fee field: every tournament is free to enter (2026-10-02, legal). */}
              <Field>
                <FieldTitle>Entry</FieldTitle>
                <p className="flex h-10 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">Free: anyone can enter.</p>
              </Field>
            </div>
            <Field data-invalid={!!errors.prizeSplit}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel>Prize split</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="bg-card" onClick={() => setSplit([100])}>
                    Winner takes all
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="bg-card" onClick={() => setSplit(DEFAULT_PRIZE_SPLIT)}>
                    Top 3 · 60/25/15
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="bg-card" onClick={() => setSplit(evenSplit(prizeFields.length))}>
                    Split evenly
                  </Button>
                </div>
              </div>
              <FieldDescription>Pay as many positions as you like. Set each one&apos;s share of the pool; the naira follow.</FieldDescription>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium">Position</th>
                      <th className="px-2 py-2.5 text-left font-medium">Share</th>
                      <th className="px-3 py-2.5 text-right font-medium">Payout</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prizeFields.map((row, i) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-medium">{ordinal(i + 1)}</td>
                        <td className="px-2 py-2">
                          <div className="relative w-28">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step="any"
                              aria-label={`${ordinal(i + 1)} place share`}
                              aria-invalid={!!errors.prizeSplit?.[i]?.share}
                              className="h-9 pr-7 tabular"
                              {...form.register(`prizeSplit.${i}.share` as const)}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular">{formatNaira(payouts[i] ?? 0)}</td>
                        <td className="px-1 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Stop paying ${ordinal(i + 1)} place`}
                            disabled={prizeFields.length === 1}
                            onClick={() => removePosition(i)}
                          >
                            <X />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between gap-2 border-t bg-paper/60 px-3 py-2 text-sm">
                  <Button type="button" size="sm" variant="ghost" onClick={() => appendPosition({ share: 0 })}>
                    <Plus />
                    Pay {ordinal(prizeFields.length + 1)} place
                  </Button>
                  <span className={cn("tabular", splitOff ? "font-medium text-flare" : "text-muted-foreground")}>
                    Total {formatPercent(total)}
                    {splitOff && ` · ${total < 100 ? `${formatPercent(100 - total)} unassigned` : `${formatPercent(total - 100)} over`}`}
                  </span>
                </div>
              </div>
              <FieldError errors={[splitError]} />
            </Field>
            {/* On or off only: which skins, titles and frames is set up in the game backend. */}
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="inGameRewards"
                render={({ field }) => <Switch id="inGameRewards" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <FieldContent>
                <FieldLabel htmlFor="inGameRewards" className="font-normal">
                  In-game rewards available
                </FieldLabel>
                <FieldDescription>Skins, titles and frames. The items are set up in the game.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Visibility">
          {lifecycleLocked ? (
            <p className="text-sm text-muted-foreground">
              This tournament is under way. Use the controls on its page to move it through its stages.
            </p>
          ) : (
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                  {VISIBILITY.map((v) => (
                    <FieldLabel key={v.value} htmlFor={`vis-${v.value}`} className="rounded-lg border has-data-checked:border-primary has-data-checked:bg-paper">
                      <Field orientation="horizontal" className="p-3">
                        <RadioGroupItem value={v.value} id={`vis-${v.value}`} />
                        <FieldContent>
                          <FieldTitle>{v.title}</FieldTitle>
                          <FieldDescription>{v.body}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              )}
            />
          )}
          <Field orientation="horizontal" className="mt-4">
            <Controller
              control={form.control}
              name="featured"
              render={({ field }) => <Switch id="featured" checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel htmlFor="featured" className="font-normal">
              Feature at the top of the Competition page
            </FieldLabel>
          </Field>
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {tournament ? "Save tournament" : "Create tournament"}
          </Button>
          <Button type="button" variant="outline" size="xl" className="bg-card" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
