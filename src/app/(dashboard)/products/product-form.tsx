"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ColourSwatch } from "@/components/shared/colour-swatch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Panel } from "@/components/shared/panel";
import { Thumb } from "@/components/shared/thumb";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCount, formatDate, formatNaira } from "@/lib/format";
import { PRODUCT_STATUS, PRODUCT_TYPE } from "@/lib/labels";
import { MAX_CUSTOM_COLOURS, STANDARD_COLOURS, STANDARD_COLOUR_IDS, colourNameTaken, newCustomColourId } from "@/lib/colours";
import { overriddenVariants } from "@/lib/pricing";
import { customColourSchema, productSchema, type CustomColourInput, type ProductInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { ComicStatus, Product, ProductColour, ProductType } from "@/types";
import { deleteProductAction, saveProductAction } from "./actions";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

/** A chapter from the Comics section that a comics product can sell. */
export type IssueOption = {
  id: string;
  /** "Vol. 1 · Ch. 1: Testing Waters". */
  label: string;
  cover: string;
  /** When the chapter releases: a listing goes on sale no earlier. */
  release: { status: ComicStatus; publishAt?: string };
  /** Already sold by a product: one store listing per chapter. */
  taken: boolean;
};

const TYPE_HELP: Record<ProductType, string> = {
  apparel: "Clothing and accessories, sold by colourway and size.",
  comics: "A chapter from the Comics section, sold online, in print, or both.",
};

function toInput(p?: Product, start?: { type?: ProductType; comicId?: string }): ProductInput {
  const blank: ProductInput = {
    type: start?.type ?? "apparel",
    status: "draft",
    exclusive: false,
    description: "",
    name: "",
    price: 10_000,
    colours: ["black"],
    customColours: [],
    sizes: ["S", "M", "L", "XL"],
    stock: {},
    customPrices: false,
    prices: {},
    image: "",
    comicId: start?.comicId ?? "",
    // No pre-filled prices: every price in the store is one an admin typed.
    formats: {
      online: { enabled: true, free: false, price: "" },
      physical: { enabled: false, price: "", stock: 0 },
    },
  };
  if (!p) return blank;
  if (p.type === "comics") {
    return {
      ...blank,
      type: "comics",
      status: p.status,
      exclusive: p.exclusive,
      description: p.description,
      comicId: p.comicId,
      formats: {
        online: {
          enabled: p.formats.online.enabled,
          free: p.formats.online.free,
          price: p.formats.online.free ? "" : String(p.formats.online.price),
        },
        physical: { enabled: p.formats.physical.enabled, price: String(p.formats.physical.price), stock: p.formats.physical.stock },
      },
    };
  }
  return {
    ...blank,
    type: "apparel",
    status: p.status,
    exclusive: p.exclusive,
    description: p.description,
    name: p.name,
    price: p.price,
    colours: p.colours.map((c) => c.id),
    customColours: p.colours.flatMap((c) => (c.hex && !STANDARD_COLOUR_IDS.includes(c.id) ? [{ id: c.id, name: c.name, hex: c.hex }] : [])),
    sizes: p.sizes,
    stock: Object.fromEntries(p.stock.map((s) => [`${s.colourId}:${s.size}`, s.quantity])),
    customPrices: overriddenVariants(p).length > 0,
    prices: Object.fromEntries(overriddenVariants(p).map((s) => [`${s.colourId}:${s.size}`, String(s.price)])),
    image: p.image,
  };
}

/** Toggle chips for colourways and sizes. */
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-paper",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Add or edit a product. TYPE comes first - Apparel or Comics, the backend's
 * two product types - and the rest of the form is that type's fields.
 * The type is fixed once the product exists.
 */
export function ProductForm({
  product,
  issues,
  start,
}: {
  product?: Product;
  issues: IssueOption[];
  /** Pre-fill for a new product, e.g. "Add to store" from a chapter. */
  start?: { type?: ProductType; comicId?: string };
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: toInput(product, start),
  });
  const { errors } = form.formState;
  const [type, colours, customColours, sizes, stock, comicId, online, physical, price, customPrices, onlineFree, status] = useWatch({
    control: form.control,
    name: [
      "type",
      "colours",
      "customColours",
      "sizes",
      "stock",
      "comicId",
      "formats.online.enabled",
      "formats.physical.enabled",
      "price",
      "customPrices",
      "formats.online.free",
      "status",
    ],
  });
  /** Every colour this product can pick from: the standard three, then the ones added to it. */
  const palette: ProductColour[] = [...STANDARD_COLOURS, ...customColours];
  const selectedColours = colours.flatMap((id) => palette.filter((c) => c.id === id));
  const total = colours.flatMap((c) => sizes.map((s) => Number(stock[`${c}:${s}`] ?? 0))).reduce((a, b) => a + b, 0);
  const issue = issues.find((i) => i.id === comicId);
  const editingComic = product?.type === "comics" ? product : null;

  // Both keep their natural order however they were clicked.
  const opts = { shouldValidate: true, shouldDirty: true } as const;
  const toggleColour = (id: string) => {
    const next = colours.includes(id) ? colours.filter((c) => c !== id) : [...colours, id];
    form.setValue("colours", palette.map((c) => c.id).filter((c) => next.includes(c)), opts);
  };
  // An added colour is selected from the moment it exists; removing it deletes it and its stock and prices.
  const addColour = (colour: CustomColourInput) => {
    form.setValue("customColours", [...customColours, colour], opts);
    form.setValue("colours", [...colours, colour.id], opts);
  };
  const removeColour = (id: string) => {
    form.setValue("customColours", customColours.filter((c) => c.id !== id), opts);
    form.setValue("colours", colours.filter((c) => c !== id), opts);
  };
  const toggleSize = (size: ProductInput["sizes"][number]) => {
    const next = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size];
    form.setValue("sizes", SIZES.filter((s) => next.includes(s)), opts);
  };

  const onSubmit = form.handleSubmit((values) =>
    startSave(async () => {
      const res = await saveProductAction(product?.id ?? null, values);
      // A successful save redirects; only an error comes back.
      if (res?.error) toast.error(res.error);
      else toast.success(product ? "Product updated" : "Product added");
    }),
  );

  function remove() {
    if (!product) return;
    startDelete(async () => {
      await deleteProductAction();
      toast.success(`${product.name} deleted`);
      router.push("/products");
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Type" description={product ? "A product's type is set when it is created." : "What kind of product this is."}>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} disabled={!!product} className="grid gap-2 sm:grid-cols-2">
                {(["apparel", "comics"] as const).map((t) => (
                  <FieldLabel key={t} htmlFor={`type-${t}`} className="rounded-lg border has-data-checked:border-primary has-data-checked:bg-paper">
                    <Field orientation="horizontal" className="p-3">
                      <RadioGroupItem value={t} id={`type-${t}`} />
                      <FieldContent>
                        <FieldTitle>{PRODUCT_TYPE[t]}</FieldTitle>
                        <FieldDescription>{TYPE_HELP[t]}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            )}
          />
        </Panel>

        {type === "comics" ? (
          <>
            <Panel title="Chapter" description="The comic book this sells. Its name and cover come from the Comics section.">
              <FieldGroup>
                <Field data-invalid={!!errors.comicId}>
                  <FieldLabel htmlFor="comicId">Chapter</FieldLabel>
                  <Controller
                    control={form.control}
                    name="comicId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)} disabled={!!product}>
                        <SelectTrigger id="comicId" className="w-full data-[size=default]:h-10" aria-invalid={!!errors.comicId}>
                          <SelectValue placeholder="Pick a chapter">
                            {(v: string) => {
                              const i = issues.find((x) => x.id === v);
                              return i ? i.label : "Pick a chapter";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {issues.map((i) => {
                            const taken = i.taken && i.id !== editingComic?.comicId;
                            return (
                              <SelectItem key={i.id} value={i.id} disabled={taken}>
                                {i.label}
                                {taken ? " (already in the store)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.comicId]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Store description</FieldLabel>
                  <Textarea id="description" rows={3} {...form.register("description")} />
                  <FieldDescription>Optional. Leave it blank to use the chapter&apos;s synopsis.</FieldDescription>
                </Field>
              </FieldGroup>
            </Panel>

            <Panel title="Sales" description="Sell the chapter online, in print, or both. Each format has its own price.">
              <div className="flex flex-col gap-3">
                <FormatRow
                  title="Online"
                  body="Read in the Beyond Service reader. Nothing to ship."
                  on={online}
                  switchId="fmt-online"
                  switchField={
                    <Controller
                      control={form.control}
                      name="formats.online.enabled"
                      render={({ field }) => <Switch id="fmt-online" checked={field.value} onCheckedChange={field.onChange} />}
                    />
                  }
                  sold={editingComic?.formats.online.unitsSold}
                >
                  <Field data-invalid={!!errors.formats?.online?.price && !onlineFree}>
                    <FieldLabel htmlFor="online-price">Price (₦)</FieldLabel>
                    <Input
                      id="online-price"
                      type="number"
                      min={1}
                      step={500}
                      inputMode="numeric"
                      className="h-10"
                      disabled={onlineFree}
                      placeholder={onlineFree ? "Free" : "e.g. 3000"}
                      aria-invalid={!!errors.formats?.online?.price && !onlineFree}
                      {...form.register("formats.online.price")}
                    />
                    <FieldDescription>{onlineFree ? "Readers pay nothing." : "Required. To give it away, use Free to read."}</FieldDescription>
                    {!onlineFree && <FieldError errors={[errors.formats?.online?.price]} />}
                  </Field>
                  {/* Free is a decision, never a blank or ₦0 price. */}
                  <Field orientation="horizontal" className="self-start sm:pt-7.5">
                    <Controller
                      control={form.control}
                      name="formats.online.free"
                      render={({ field }) => (
                        <Switch
                          id="online-free"
                          checked={field.value}
                          onCheckedChange={(on) => {
                            field.onChange(on);
                            if (form.formState.isSubmitted) form.trigger("formats.online.price");
                          }}
                        />
                      )}
                    />
                    <FieldLabel htmlFor="online-free" className="font-normal">
                      Free to read
                    </FieldLabel>
                  </Field>
                </FormatRow>
                <FormatRow
                  title="Physical"
                  body="The printed book, shipped with merch orders."
                  on={physical}
                  switchId="fmt-physical"
                  switchField={
                    <Controller
                      control={form.control}
                      name="formats.physical.enabled"
                      render={({ field }) => <Switch id="fmt-physical" checked={field.value} onCheckedChange={field.onChange} />}
                    />
                  }
                  sold={editingComic?.formats.physical.unitsSold}
                >
                  <Field data-invalid={!!errors.formats?.physical?.price}>
                    <FieldLabel htmlFor="physical-price">Price (₦)</FieldLabel>
                    <Input id="physical-price" type="number" min={0} step={500} className="h-10" aria-invalid={!!errors.formats?.physical?.price} {...form.register("formats.physical.price")} />
                    <FieldError errors={[errors.formats?.physical?.price]} />
                  </Field>
                  <Field data-invalid={!!errors.formats?.physical?.stock}>
                    <FieldLabel htmlFor="physical-stock">Copies in stock</FieldLabel>
                    <Input id="physical-stock" type="number" min={0} className="h-10" aria-invalid={!!errors.formats?.physical?.stock} {...form.register("formats.physical.stock")} />
                    <FieldError errors={[errors.formats?.physical?.stock]} />
                  </Field>
                </FormatRow>
                <FieldError errors={[errors.formats as { message?: string } | undefined]} />
              </div>
            </Panel>
          </>
        ) : (
          <>
            <Panel title="Details">
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" className="h-10" aria-invalid={!!errors.name} {...form.register("name")} placeholder="Goondu Hoodie" />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field data-invalid={!!errors.description}>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
                  <FieldDescription>Shown on the product page. Material, fit and care.</FieldDescription>
                  <FieldError errors={[errors.description]} />
                </Field>
                <Field data-invalid={!!errors.price} className="sm:max-w-xs">
                  <FieldLabel htmlFor="price">Price (₦)</FieldLabel>
                  <Input id="price" type="number" inputMode="numeric" min={0} step={500} className="h-10" aria-invalid={!!errors.price} {...form.register("price")} />
                  <FieldDescription>Every variant sells at this price unless you give it its own.</FieldDescription>
                  <FieldError errors={[errors.price]} />
                </Field>
              </FieldGroup>
            </Panel>

            <Panel title="Variants & stock" description="Pick the colourways and sizes you sell, then count what's on the shelf.">
              <FieldGroup>
                <Field data-invalid={!!errors.colours}>
                  <FieldLabel>Colourways</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {STANDARD_COLOURS.map((c) => (
                      <Toggle key={c.id} on={colours.includes(c.id)} onClick={() => toggleColour(c.id)}>
                        <ColourSwatch colour={c} />
                        {c.name}
                      </Toggle>
                    ))}
                    {customColours.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-primary pr-1 pl-3 text-sm text-primary-foreground"
                      >
                        <ColourSwatch colour={c} />
                        {c.name}
                        <button
                          type="button"
                          onClick={() => removeColour(c.id)}
                          aria-label={`Remove ${c.name}`}
                          className="grid size-7 place-items-center rounded-md hover:bg-white/15"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    {customColours.length < MAX_CUSTOM_COLOURS && <AddColour taken={palette} onAdd={addColour} />}
                  </div>
                  <FieldDescription>Need another colourway? Add it and name it. Added colours belong to this product.</FieldDescription>
                  <FieldError errors={[errors.colours, errors.customColours as { message?: string } | undefined]} />
                </Field>
                <Field data-invalid={!!errors.sizes}>
                  <FieldLabel>Sizes</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {SIZES.map((s) => (
                      <Toggle key={s} on={sizes.includes(s)} onClick={() => toggleSize(s)}>
                        {s}
                      </Toggle>
                    ))}
                  </div>
                  <FieldDescription>One-size items like caps and totes: pick M.</FieldDescription>
                  <FieldError errors={[errors.sizes]} />
                </Field>

                {colours.length > 0 && sizes.length > 0 && (
                  <VariantGrid
                    colours={selectedColours}
                    sizes={sizes}
                    cell={(c, s) => (
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`${c.name} ${s} stock`}
                        className="h-9 w-full min-w-14 text-center tabular"
                        {...form.register(`stock.${c.id}:${s}` as const)}
                      />
                    )}
                    footer={
                      <>
                        Total on hand: <span className="font-medium text-foreground tabular">{formatCount(total)}</span>
                      </>
                    }
                  />
                )}
              </FieldGroup>
            </Panel>

            <Panel title="Variant pricing" description={`Every variant sells at the product's price (${formatNaira(Number(price) || 0)}) unless you override it.`}>
              <FieldGroup>
                <Field orientation="horizontal">
                  <Controller
                    control={form.control}
                    name="customPrices"
                    render={({ field }) => <Switch id="customPrices" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                  <FieldLabel htmlFor="customPrices" className="font-normal">
                    Price some variants differently
                  </FieldLabel>
                </Field>
                {/* Stays mounted when off, so overrides survive switching it off and on; the save drops them while off. */}
                <div className={cn("flex flex-col gap-2", !customPrices && "hidden")}>
                  {colours.length > 0 && sizes.length > 0 ? (
                    <VariantGrid
                      colours={selectedColours}
                      sizes={sizes}
                      cell={(c, s) => (
                        <Input
                          type="number"
                          min={0}
                          step={500}
                          inputMode="numeric"
                          aria-label={`${c.name} ${s} price`}
                          aria-invalid={!!errors.prices?.[`${c.id}:${s}`]}
                          placeholder={formatCount(Number(price) || 0)}
                          className="h-9 w-full min-w-20 text-center tabular placeholder:text-muted-foreground/60"
                          {...form.register(`prices.${c.id}:${s}` as const)}
                        />
                      )}
                      footer="Leave a cell blank to use the product's price, and follow it if that price changes."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Pick colourways and sizes first.</p>
                  )}
                  <FieldError errors={Object.values(errors.prices ?? {}).slice(0, 1)} />
                </div>
              </FieldGroup>
            </Panel>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {type === "comics" ? (
          <Panel title="Cover" description="From the chapter. Change it in Comics.">
            {issue ? (
              <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-entry">
                <Thumb src={issue.cover} alt="" fill sizes="400px" className="object-cover object-top" />
              </div>
            ) : (
              <p className="rounded-xl border-2 border-dashed border-mist px-4 py-10 text-center text-sm text-muted-foreground">
                Pick a chapter to see its cover.
              </p>
            )}
          </Panel>
        ) : (
          <Panel title="Image">
            <Controller
              control={form.control}
              name="image"
              render={({ field }) => <ImageDropzone value={field.value} onChange={field.onChange} invalid={!!errors.image} />}
            />
            <FieldError className="mt-2" errors={[errors.image]} />
          </Panel>
        )}

        <Panel title="Visibility">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                    <SelectTrigger id="status" className="w-full data-[size=default]:h-10">
                      <SelectValue>{(v: keyof typeof PRODUCT_STATUS) => PRODUCT_STATUS[v]?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active: in the store</SelectItem>
                      <SelectItem value="draft">Draft: not published</SelectItem>
                      <SelectItem value="archived">Archived: hidden</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {/* A comics listing goes on sale with its chapter, never before it. */}
              {type === "comics" && issue && status === "active" && issue.release.status !== "published" && (
                <FieldDescription className={cn(issue.release.status === "draft" && "text-flare")}>
                  {issue.release.status === "scheduled" && issue.release.publishAt
                    ? `Goes on sale when the chapter releases, ${formatDate(issue.release.publishAt)}.`
                    : "The chapter is still a draft. Schedule or publish it in Comics before this goes on sale."}
                </FieldDescription>
              )}
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="exclusive"
                render={({ field }) => <Switch id="exclusive" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <FieldLabel htmlFor="exclusive" className="font-normal">
                Show the EXCLUSIVE plate on the store tile
              </FieldLabel>
            </Field>
          </FieldGroup>
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {product ? "Save changes" : "Add product"}
          </Button>
          <Button type="button" variant="outline" size="xl" className="bg-card" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        {product && (
          <Panel title="Danger zone" className="ring-flare/30">
            <p className="text-sm text-muted-foreground">
              Deleting removes it from the store. Past orders keep their line items
              {product.type === "comics" ? ", and the chapter stays in Comics" : ""}.
            </p>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" className="mt-3" disabled={deleting}>
                  <Trash2 />
                  Delete product
                </Button>
              }
              title={`Delete ${product.name}?`}
              description="This can't be undone. If you might sell it again, archive it instead."
              confirmLabel="Delete"
              destructive
              onConfirm={remove}
            />
          </Panel>
        )}
      </div>
    </form>
  );
}

/**
 * "Add colour": name a colourway and pick its swatch. It checks the name
 * against every colour the product already has, then hands the colour up.
 */
function AddColour({ taken, onAdd }: { taken: readonly ProductColour[]; onAdd: (colour: CustomColourInput) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#3b5b8c");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const colour = { id: newCustomColourId(), name: name.trim().replace(/\s+/g, " "), hex };
    const parsed = customColourSchema.safeParse(colour);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the colour");
    if (colourNameTaken(colour.name, taken)) return setError(`There's already a colour called ${colour.name}`);
    onAdd(parsed.data);
    setName("");
    setError(null);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:bg-paper hover:text-foreground"
          />
        }
      >
        <Plus className="size-3.5" />
        Add colour
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle>New colourway</PopoverTitle>
        </PopoverHeader>
        <FieldGroup className="mt-3 gap-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="new-colour-name">Name</FieldLabel>
            <Input
              id="new-colour-name"
              autoFocus
              maxLength={24}
              value={name}
              placeholder="Forest Green"
              aria-invalid={!!error}
              className="h-10"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="new-colour-hex">Swatch</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                id="new-colour-hex"
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border bg-card p-1"
              />
              <span className="text-sm text-muted-foreground uppercase tabular">{hex}</span>
            </div>
            <FieldDescription>Shown as the dot beside the name. Customers see the name.</FieldDescription>
          </Field>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm">
              <ColourSwatch colour={{ hex }} />
              {name.trim() || "Preview"}
            </span>
            <Button type="button" onClick={add}>
              Add
            </Button>
          </div>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

/** A colour-by-size table, one input per variant: the stock grid and the price grid. */
function VariantGrid({
  colours,
  sizes,
  cell,
  footer,
}: {
  colours: readonly ProductColour[];
  sizes: readonly string[];
  cell: (colour: ProductColour, size: string) => React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-paper text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">Colour</th>
            {sizes.map((s) => (
              <th key={s} className="px-2 py-2.5 text-center font-medium">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {colours.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-medium">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <ColourSwatch colour={c} />
                  {c.name}
                </span>
              </td>
              {sizes.map((s) => (
                <td key={s} className="px-1.5 py-2">
                  {cell(c, s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t bg-paper/60 px-3 py-2 text-right text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}

/** One way of selling a comic: a switch, and its fields while it is on. */
function FormatRow({
  title,
  body,
  on,
  switchField,
  switchId,
  sold,
  children,
}: {
  title: string;
  body: string;
  on: boolean;
  switchField: React.ReactNode;
  switchId: string;
  /** Present when editing a product that exists. */
  sold?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-4 transition-colors", on && "border-primary/40 bg-paper/50")}>
      <div className="flex items-start gap-3">
        {switchField}
        <label htmlFor={switchId} className="flex-1 cursor-pointer">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{body}</span>
        </label>
        {sold !== undefined && <span className="text-xs text-muted-foreground tabular">{formatCount(sold)} sold</span>}
      </div>
      {/* Fields stay mounted when off, so a price survives switching the format off and on. */}
      <div className={cn("mt-4 grid gap-4 sm:grid-cols-2", !on && "hidden")}>{children}</div>
    </div>
  );
}
