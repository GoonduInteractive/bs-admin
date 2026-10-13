"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { chapterName } from "@/lib/comics";
import { formatDateTime } from "@/lib/format";
import { fromLagosInput, toLagosInput } from "@/lib/lagos-time";
import { comicSchema, type ChapterPricingInput, type ComicInput } from "@/lib/schemas";
import type { Comic, ComicVolume } from "@/types";
import { deleteComicAction, saveComicAction } from "./actions";
import { PageManager } from "./page-manager";
import { PricePrompt } from "./price-prompt";

const RELEASE = [
  { value: "draft", title: "Draft", body: "Only admins can see it." },
  { value: "scheduled", title: "Scheduled", body: "Goes live on the date you pick." },
  { value: "published", title: "Published", body: "Live on the site now." },
] as const;

/** A chapter's price as the form needs it. */
export type ChapterSale = { priced: boolean; formats: ChapterPricingInput["formats"] };

/** A new chapter, or one never priced: blank prices, online on. */
const NOT_PRICED: ChapterSale = {
  priced: false,
  formats: { online: { enabled: true, free: false, price: "" }, physical: { enabled: false, price: "", stock: 0 } },
};

function toInput(c: Comic | undefined, volumeId: string, chapter: number): ComicInput {
  return {
    title: c?.title ?? "",
    volumeId: c?.volumeId ?? volumeId,
    chapter: c?.chapter ?? chapter,
    description: c?.description ?? "",
    status: c?.status ?? "draft",
    publishAt: c?.status === "scheduled" ? toLagosInput(c.publishAt) : "",
    cover: c?.cover ?? "",
    pages: c?.pages.map((p) => ({ id: p.id, src: p.src })) ?? [],
  };
}

/**
 * Add or edit a chapter: which volume it's compiled into, its number there,
 * its own title, cover and pages, and when it's released.
 */
export function ComicForm({
  comic,
  volumes,
  nextChapter,
  startVolumeId,
  sale = NOT_PRICED,
}: {
  comic?: Comic;
  /** Every volume, in order. A chapter must belong to one. */
  volumes: ComicVolume[];
  /** The next free chapter number in each volume, by volume id. */
  nextChapter: Record<string, number>;
  /** Pre-picked volume for a new chapter, e.g. from a volume's "Add chapter". */
  startVolumeId?: string;
  /**
   * Whether the chapter already has a price, and the prices it had (to
   * pre-fill the prompt). Unpriced, scheduling or publishing asks for one.
   */
  sale?: ChapterSale;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const firstVolume = startVolumeId ?? volumes.at(-1)?.id ?? "";
  const form = useForm<ComicInput>({
    resolver: zodResolver(comicSchema),
    defaultValues: toInput(comic, firstVolume, nextChapter[firstVolume] ?? 1),
  });
  const { errors } = form.formState;
  const [status, volumeId, chapterNo, title] = useWatch({ control: form.control, name: ["status", "volumeId", "chapter", "title"] });
  const volume = volumes.find((v) => v.id === volumeId);

  // A new chapter follows its volume: switch volume and it takes that volume's next number,
  // unless the admin has typed a number themselves.
  const pickVolume = (id: string) => {
    form.setValue("volumeId", id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    if (!comic && !form.getFieldState("chapter").isDirty) form.setValue("chapter", nextChapter[id] ?? 1);
  };

  const save = (values: ComicInput, pricing?: ChapterPricingInput) =>
    startSave(async () => {
      const res = await saveComicAction(comic?.id ?? null, values, pricing);
      if (res?.error) toast.error(res.error);
      else toast.success(comic ? "Chapter saved" : "Chapter added");
    });

  // No price, no release: scheduling or publishing an unpriced chapter opens the
  // price prompt, and the chapter saves only once it has one. Held values wait here.
  const [held, setHeld] = useState<ComicInput | null>(null);
  const onSubmit = form.handleSubmit((values) => {
    if (values.status !== "draft" && !sale.priced) setHeld(values);
    else save(values);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <PricePrompt
        open={!!held}
        action={held?.status === "published" ? "Publish" : "Schedule"}
        releaseDate={held?.status === "scheduled" && held.publishAt ? formatDateTime(fromLagosInput(held.publishAt)) : null}
        defaults={sale.formats}
        onCancel={() => setHeld(null)}
        onSave={(pricing) => {
          const values = held!;
          setHeld(null);
          save(values, pricing);
        }}
      />
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Chapter" description="Each chapter is one comic book. Chapters compile, in order, into their volume.">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <Field data-invalid={!!errors.volumeId}>
                <FieldLabel htmlFor="volumeId">Volume</FieldLabel>
                <Select value={volumeId} onValueChange={(v) => pickVolume(String(v))}>
                  <SelectTrigger id="volumeId" className="w-full data-[size=default]:h-10" aria-invalid={!!errors.volumeId}>
                    <SelectValue placeholder="Pick a volume">
                      {(id: string) => {
                        const v = volumes.find((x) => x.id === id);
                        return v ? `Vol. ${v.number} · ${v.title}` : "Pick a volume";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {volumes.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        Vol. {v.number} · {v.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Need a new one?{" "}
                  <Link href="/comics/volumes/new" className="font-medium text-signal hover:underline">
                    Create a volume
                  </Link>
                </FieldDescription>
                <FieldError errors={[errors.volumeId]} />
              </Field>
              <Field data-invalid={!!errors.chapter}>
                <FieldLabel htmlFor="chapter">Chapter</FieldLabel>
                <Input id="chapter" type="number" min={1} inputMode="numeric" className="h-10" aria-invalid={!!errors.chapter} {...form.register("chapter")} />
                <FieldError errors={[errors.chapter]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Chapter title</FieldLabel>
              <Input id="title" className="h-10" placeholder="Testing Waters" aria-invalid={!!errors.title} {...form.register("title")} />
              {volume && <FieldDescription>Shown in the store and on orders as “{chapterName({ chapter: Number(chapterNo) || 1, title: title.trim() || "…" }, volume)}”.</FieldDescription>}
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Synopsis</FieldLabel>
              <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
              <FieldDescription>Shown beside the cover on the Comics page.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
        </Panel>


        <Panel title="Pages" description="In reading order. Drag to reorder.">
          <Controller
            control={form.control}
            name="pages"
            render={({ field }) => <PageManager value={field.value} onChange={field.onChange} invalid={!!errors.pages} />}
          />
          <FieldError className="mt-2" errors={[errors.pages as { message?: string } | undefined]} />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Cover">
          <Controller
            control={form.control}
            name="cover"
            render={({ field }) => (
              <ImageDropzone
                value={field.value}
                onChange={field.onChange}
                aspect="aspect-[4/5]"
                fit="object-cover"
                label="Drop the cover here, or browse"
                hint="Portrait, 4:5. PNG, JPG or WebP."
                invalid={!!errors.cover}
              />
            )}
          />
          <FieldError className="mt-2" errors={[errors.cover]} />
        </Panel>

        <Panel title="Release">
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                {RELEASE.map((r) => (
                  <FieldLabel key={r.value} htmlFor={`status-${r.value}`} className="rounded-lg border has-data-checked:border-primary has-data-checked:bg-paper">
                    <Field orientation="horizontal" className="p-3">
                      <RadioGroupItem value={r.value} id={`status-${r.value}`} />
                      <FieldContent>
                        <FieldTitle>{r.title}</FieldTitle>
                        <FieldDescription>{r.body}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            )}
          />
          {status === "scheduled" && (
            <Field className="mt-4" data-invalid={!!errors.publishAt}>
              <FieldLabel htmlFor="publishAt">Release date (Lagos time)</FieldLabel>
              <Input id="publishAt" type="datetime-local" className="h-10" aria-invalid={!!errors.publishAt} {...form.register("publishAt")} />
              <FieldError errors={[errors.publishAt]} />
            </Field>
          )}
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {comic ? "Save chapter" : "Add chapter"}
          </Button>
          <Button type="button" variant="outline" size="xl" className="bg-card" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        {comic && (
          <Panel title="Danger zone" className="ring-flare/30">
            <p className="text-sm text-muted-foreground">Deleting removes the chapter and its pages from the reader. The rest of the volume is untouched.</p>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" className="mt-3" disabled={deleting}>
                  <Trash2 />
                  Delete chapter
                </Button>
              }
              title={`Delete Chapter ${comic.chapter}: ${comic.title}?`}
              description="Readers lose access immediately. Print orders already placed are not affected."
              confirmLabel="Delete"
              destructive
              onConfirm={() => startDelete(() => deleteComicAction(comic.id))}
            />
          </Panel>
        )}
      </div>
    </form>
  );
}

