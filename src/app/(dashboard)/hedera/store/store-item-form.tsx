"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCount, formatHbar } from "@/lib/format";
import { assetIdFor, estimateHbar, formatPrice } from "@/lib/hedera/catalogue";
import { toLagosInput } from "@/lib/lagos-time";
import { ASSET_COLLECTION, ASSET_FAMILY, ASSET_RARITY } from "@/lib/labels";
import { storeItemSchema, type StoreItemInput } from "@/lib/schemas";
import { ASSET_FAMILIES, ASSET_RARITIES, PRICE_CURRENCIES, type HbarRate, type StoreItem } from "@/types/hedera";
import { saveStoreItemAction } from "../actions";

const ACCESS = [
  { value: "sale", title: "Sold in the game store", body: "For HBAR on the website, priced in naira or dollars." },
  { value: "free", title: "Free on wallet link", body: "Every player who links a Hedera wallet can claim one." },
] as const;

const CURRENCY: Record<StoreItemInput["priceCurrency"], string> = { NGN: "Naira (₦)", USD: "US dollars ($)" };

function toInput(i?: StoreItem): StoreItemInput {
  return {
    name: i?.name ?? "",
    description: i?.description ?? "",
    family: i?.family ?? "skin",
    rarity: i?.rarity ?? "rare",
    image: i?.image ?? "",
    imageAlt: i?.imageAlt ?? "",
    access: i?.access ?? "sale",
    priceAmount: i?.price?.amount ?? 0,
    priceCurrency: i?.price?.currency ?? "NGN",
    limited: !!i?.supply,
    // Kept for switching Limited on again; ignored while it's off.
    editionSize: i?.supply?.total ?? 500,
    saleStartsAt: toLagosInput(i?.saleStartsAt ?? undefined),
    saleEndsAt: toLagosInput(i?.saleEndsAt ?? undefined),
    published: i?.published ?? false,
  };
}

export function StoreItemForm({ item, rate }: { item?: StoreItem; rate: HbarRate }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const form = useForm<StoreItemInput>({ resolver: zodResolver(storeItemSchema), defaultValues: toInput(item) });
  const { errors } = form.formState;
  const [name, family, access, priceAmount, priceCurrency, limited, published] = useWatch({
    control: form.control,
    name: ["name", "family", "access", "priceAmount", "priceCurrency", "limited", "published"],
  });
  const free = access === "free";
  const amount = Number(priceAmount) || 0;
  const assetId = item?.id ?? (name.trim() ? assetIdFor(family, name) : `bs-${family}-…`);
  const sold = item?.sold ?? 0;

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await saveStoreItemAction(item?.id ?? null, values);
      if (res?.error) toast.error(res.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Details">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" className="h-10" placeholder="Kaira: Nightveil" aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldDescription>As players see it in the store and in the game&apos;s inventory.</FieldDescription>
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={3} aria-invalid={!!errors.description} {...form.register("description")} />
              <FieldDescription>One or two lines. Say what it is, never what it might be worth.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.family}>
                <FieldLabel htmlFor="family">Family</FieldLabel>
                <Controller
                  control={form.control}
                  name="family"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v)} disabled={!!item}>
                      <SelectTrigger id="family" className="w-full data-[size=default]:h-10">
                        <SelectValue>{(v: StoreItemInput["family"]) => ASSET_FAMILY[v]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_FAMILIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {ASSET_FAMILY[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  {item ? "Fixed: it was minted into this family's collection." : `Mints into the ${ASSET_COLLECTION[family]} collection. Can't change later.`}
                </FieldDescription>
              </Field>
              <Field data-invalid={!!errors.rarity}>
                <FieldLabel htmlFor="rarity">Rarity</FieldLabel>
                <Controller
                  control={form.control}
                  name="rarity"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                      <SelectTrigger id="rarity" className="w-full data-[size=default]:h-10">
                        <SelectValue>{(v: StoreItemInput["rarity"]) => ASSET_RARITY[v].label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_RARITIES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ASSET_RARITY[r].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </FieldGroup>
        </Panel>

        <Panel title="Price and supply">
          <FieldGroup>
            <Controller
              control={form.control}
              name="access"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                  {ACCESS.map((a) => (
                    <FieldLabel key={a.value} htmlFor={`access-${a.value}`} className="rounded-lg border has-data-checked:border-primary has-data-checked:bg-paper">
                      <Field orientation="horizontal" className="p-3">
                        <RadioGroupItem value={a.value} id={`access-${a.value}`} />
                        <FieldContent>
                          <FieldTitle>{a.title}</FieldTitle>
                          <FieldDescription>{a.body}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              )}
            />
            {!free && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.priceAmount}>
                  <FieldLabel htmlFor="priceAmount">Price</FieldLabel>
                  <Input
                    id="priceAmount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className="h-10 tabular"
                    aria-invalid={!!errors.priceAmount}
                    {...form.register("priceAmount")}
                  />
                  <FieldDescription>
                    {amount > 0
                      ? `${formatPrice({ amount, currency: priceCurrency })} is about ${formatHbar(estimateHbar({ amount, currency: priceCurrency }, rate))} at today's rate. The checkout quotes the exact HBAR, held for 10 minutes.`
                      : "The checkout quotes it in HBAR, held for 10 minutes."}
                  </FieldDescription>
                  <FieldError errors={[errors.priceAmount]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="priceCurrency">Currency</FieldLabel>
                  <Controller
                    control={form.control}
                    name="priceCurrency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                        <SelectTrigger id="priceCurrency" className="w-full data-[size=default]:h-10">
                          <SelectValue>{(v: StoreItemInput["priceCurrency"]) => CURRENCY[v]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {CURRENCY[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
            )}
            <Field data-invalid={!!errors.editionSize && limited}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="editionSize">Supply</FieldLabel>
                <span className="flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name="limited"
                    render={({ field }) => <Switch id="limited" size="sm" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                  <FieldLabel htmlFor="limited" className="text-xs font-normal text-muted-foreground">
                    Limited edition
                  </FieldLabel>
                </span>
              </div>
              {limited ? (
                <Input
                  id="editionSize"
                  type="number"
                  inputMode="numeric"
                  min={Math.max(1, sold)}
                  step={1}
                  className="h-10 tabular"
                  aria-invalid={!!errors.editionSize}
                  {...form.register("editionSize")}
                />
              ) : (
                <p className="flex h-10 items-center rounded-lg border border-dashed px-3 text-sm text-muted-foreground">Unlimited: it never sells out.</p>
              )}
              <FieldDescription>
                {limited
                  ? sold
                    ? `${formatCount(sold)} have gone to players, so the edition can't go below that. Players were told the size: change it only if you must.`
                    : "How many will ever exist. Once it's on sale, keep it: players buy on that number."
                  : "Turn Limited edition on to set a fixed number."}
              </FieldDescription>
              {limited && <FieldError errors={[errors.editionSize]} />}
            </Field>
          </FieldGroup>
        </Panel>

        <Panel title={free ? "Claim window" : "Sale window"} description="Lagos time (WAT). Leave both empty to keep it on the store for as long as it's published.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.saleStartsAt}>
              <FieldLabel htmlFor="saleStartsAt">Opens</FieldLabel>
              <Input id="saleStartsAt" type="datetime-local" className="h-10" {...form.register("saleStartsAt")} />
              <FieldDescription>Empty: as soon as it&apos;s published.</FieldDescription>
            </Field>
            <Field data-invalid={!!errors.saleEndsAt}>
              <FieldLabel htmlFor="saleEndsAt">Closes</FieldLabel>
              <Input id="saleEndsAt" type="datetime-local" className="h-10" aria-invalid={!!errors.saleEndsAt} {...form.register("saleEndsAt")} />
              <FieldDescription>The store counts down to it, as a limited-time sale.</FieldDescription>
              <FieldError errors={[errors.saleEndsAt]} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Picture">
          <Controller
            control={form.control}
            name="image"
            render={({ field }) => (
              <ImageDropzone value={field.value} onChange={field.onChange} invalid={!!errors.image} aspect="aspect-[4/5]" fit="object-cover" />
            )}
          />
          <FieldError className="mt-2" errors={[errors.image]} />
          <Field data-invalid={!!errors.imageAlt} className="mt-4">
            <FieldLabel htmlFor="imageAlt">Picture description</FieldLabel>
            <Input id="imageAlt" className="h-10" placeholder="Kaira in the Nightveil skin" aria-invalid={!!errors.imageAlt} {...form.register("imageAlt")} />
            <FieldError errors={[errors.imageAlt]} />
          </Field>
        </Panel>

        <Panel title="On chain">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Asset ID</dt>
              <dd className="mt-0.5 font-mono break-all">{assetId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Collection</dt>
              <dd className="mt-0.5">
                {ASSET_COLLECTION[family]}
                {item && <span className="ml-1.5 font-mono text-muted-foreground">{item.tokenId}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recognised by</dt>
              <dd className="mt-0.5">{(item?.games ?? ["Beyond Service: Trial of the Gods"]).join(", ")}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            The asset ID stays the same for good, so a future Goondu game can recognise the same NFT. Who owns each one is public on Hedera.
          </p>
        </Panel>

        <Panel title="Visibility">
          <Field orientation="horizontal">
            <Controller control={form.control} name="published" render={({ field }) => <Switch id="published" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldContent>
              <FieldLabel htmlFor="published" className="font-normal">
                Published
              </FieldLabel>
              <FieldDescription>
                {published
                  ? "On the store inside its window. Unpublishing takes it off; players who have it keep it."
                  : item?.publishedAt
                    ? "Off the store. Players who have it keep it."
                    : "A draft: only admins see it."}
              </FieldDescription>
            </FieldContent>
          </Field>
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {item ? "Save item" : "Add item"}
          </Button>
          <Button type="button" variant="outline" size="xl" className="bg-card" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
