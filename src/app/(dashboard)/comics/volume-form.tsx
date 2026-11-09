"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMIC_STATUS } from "@/lib/labels";
import { volumeSchema, type VolumeInput } from "@/lib/schemas";
import type { Comic, ComicVolume } from "@/types";
import { deleteVolumeAction, saveVolumeAction } from "./actions";

/**
 * Create or edit a volume: the collected edition. Its chapters are added
 * from the chapter form; here they're listed in the order they compile.
 */
export function VolumeForm({
  volume,
  chapters = [],
  nextNumber = 1,
}: {
  volume?: ComicVolume;
  /** This volume's chapters, in order. */
  chapters?: Comic[];
  /** The number a new volume takes by default. */
  nextNumber?: number;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const form = useForm<VolumeInput>({
    resolver: zodResolver(volumeSchema),
    defaultValues: {
      number: volume?.number ?? nextNumber,
      title: volume?.title ?? "",
      description: volume?.description ?? "",
      cover: volume?.cover ?? "",
    },
  });
  const { errors } = form.formState;
  const cover = useWatch({ control: form.control, name: "cover" });

  const onSubmit = form.handleSubmit((values) =>
    startSave(async () => {
      // A successful save redirects; only an error comes back.
      const res = await saveVolumeAction(volume?.id ?? null, values);
      if (res?.error) toast.error(res.error);
      else toast.success(volume ? "Volume saved" : "Volume created");
    }),
  );

  function remove() {
    if (!volume) return;
    startDelete(async () => {
      const res = await deleteVolumeAction(volume.id);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel title="Volume" description="A volume collects chapters in order, e.g. Chapters 1 to 10 make Volume 1.">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
              <Field data-invalid={!!errors.number}>
                <FieldLabel htmlFor="number">Number</FieldLabel>
                <Input id="number" type="number" min={1} inputMode="numeric" className="h-10" aria-invalid={!!errors.number} {...form.register("number")} />
                <FieldError errors={[errors.number]} />
              </Field>
              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" className="h-10" placeholder="Trial of the Gods" aria-invalid={!!errors.title} {...form.register("title")} />
                <FieldError errors={[errors.title]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Synopsis</FieldLabel>
              <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...form.register("description")} />
              <FieldDescription>The whole volume&apos;s story. Each chapter has its own synopsis too.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
        </Panel>

        {volume && (
          <Panel
            title="Chapters"
            description={chapters.length ? `${chapters.length} chapter${chapters.length === 1 ? "" : "s"}, in reading order.` : "No chapters yet."}
            action={
              <Button type="button" variant="outline" size="sm" className="bg-card" render={<Link href={`/comics/new?volume=${volume.id}`} />}>
                <Plus />
                Add chapter
              </Button>
            }
          >
            {chapters.length > 0 && (
              <ol className="divide-y rounded-lg border">
                {chapters.map((c) => (
                  <li key={c.id}>
                    <Link href={`/comics/${c.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-paper">
                      <span className="w-12 shrink-0 font-display text-base leading-none font-semibold uppercase">Ch. {c.chapter}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{c.pages.length} pages</span>
                      <StatusBadge {...COMIC_STATUS[c.status]} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        )}

      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Cover" description="Optional. Without one, Chapter 1's cover stands in.">
          <Controller
            control={form.control}
            name="cover"
            render={({ field }) => (
              <ImageDropzone
                value={field.value}
                onChange={field.onChange}
                aspect="aspect-[4/5]"
                fit="object-cover"
                label="Drop the volume cover here, or browse"
                hint="Portrait, 4:5. PNG, JPG or WebP."
              />
            )}
          />
          {cover && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => form.setValue("cover", "", { shouldDirty: true })}>
              Use Chapter 1&apos;s cover instead
            </Button>
          )}
        </Panel>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {volume ? "Save volume" : "Create volume"}
          </Button>
          <Button type="button" variant="outline" size="xl" className="bg-card" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        {volume && (
          <Panel title="Danger zone" className="ring-flare/30">
            <p className="text-sm text-muted-foreground">
              {chapters.length
                ? "A volume with chapters can't be deleted. Move its chapters to another volume or delete them first."
                : "Deleting removes the empty volume."}
            </p>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" className="mt-3" disabled={deleting || chapters.length > 0}>
                  <Trash2 />
                  Delete volume
                </Button>
              }
              title={`Delete Volume ${volume.number}: ${volume.title}?`}
              description="This can't be undone."
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
