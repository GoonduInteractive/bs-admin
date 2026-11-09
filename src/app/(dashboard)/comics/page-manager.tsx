"use client";

import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Thumb } from "@/components/shared/thumb";
import { Button } from "@/components/ui/button";
import { ACCEPT_IMAGES, batchesOf, checkImage, uploadImages } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

export type PageItem = { id: string; src: string };

/**
 * The chapter's pages, in reading order. Files dropped together are uploaded in
 * name order (page-01, page-02, ...), so a folder export lands the right way
 * round. Reorder by dragging a tile, or with its arrow buttons from the keyboard.
 */
export function PageManager({
  value,
  onChange,
  invalid,
}: {
  value: PageItem[];
  onChange: (pages: PageItem[]) => void;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);

  async function add(files: FileList | File[]) {
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const bad = list.map(checkImage).filter(Boolean);
    bad.forEach((msg) => toast.error(msg));
    const good = list.filter((f) => !checkImage(f));
    if (!good.length) return;

    setProgress({ done: 0, total: good.length });
    const added: PageItem[] = [];
    // Several pages a request (`uploadImages`), in batches that keep their order.
    for (const batch of batchesOf(good)) {
      try {
        const urls = await uploadImages(batch);
        added.push(...urls.map((src) => ({ id: crypto.randomUUID(), src })));
      } catch (e) {
        const names = batch.map((f) => f.name).join(", ");
        toast.error(e instanceof Error ? `${names}: ${e.message}` : `${names} failed`);
      }
      setProgress((p) => p && { ...p, done: p.done + batch.length });
    }
    onChange([...value, ...added]);
    setProgress(null);
    if (input.current) input.current.value = "";
    if (added.length) toast.success(`${added.length} page${added.length > 1 ? "s" : ""} added`);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function onZoneDrop(e: DragEvent) {
    e.preventDefault();
    setFileOver(false);
    if (e.dataTransfer.files.length) add(e.dataTransfer.files);
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.target.files && add(e.target.files)}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          if (dragFrom !== null) return;
          e.preventDefault();
          setFileOver(true);
        }}
        onDragLeave={() => setFileOver(false)}
        onDrop={onZoneDrop}
        disabled={!!progress}
        data-invalid={invalid || undefined}
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-mist bg-paper/50 px-6 py-8 text-left transition-colors hover:border-slate/40 hover:bg-paper",
          fileOver && "border-signal bg-blush/40",
          invalid && "border-flare",
        )}
      >
        {progress ? <Loader2 className="size-7 shrink-0 animate-spin text-muted-foreground" /> : <ImagePlus className="size-7 shrink-0 stroke-[1.5] text-muted-foreground" />}
        <span>
          <span className="block text-sm font-medium">
            {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : "Drop pages here, or browse"}
          </span>
          <span className="block text-xs text-muted-foreground">
            Select several at once. They&apos;re added in file-name order, after the pages already here.
          </span>
        </span>
      </button>

      {value.length > 0 && (
        <ol className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          {value.map((page, i) => (
            <li
              key={page.id}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={cn(
                "group relative cursor-grab overflow-hidden rounded-lg bg-ink ring-1 ring-foreground/10 active:cursor-grabbing",
                dragFrom === i && "opacity-40",
                dragOver === i && dragFrom !== i && "ring-2 ring-signal",
              )}
            >
              <div className="relative aspect-[2/3]">
                <Thumb src={page.src} alt={`Page ${i + 1}`} fill sizes="160px" className="object-cover" />
              </div>
              <span className="absolute top-1.5 left-1.5 grid h-6 min-w-6 place-items-center rounded-md bg-ink/80 px-1.5 text-xs font-medium text-white tabular">
                {i + 1}
              </span>
              <GripVertical className="absolute top-1.5 right-1.5 size-4 text-white/70 drop-shadow" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/75 p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button type="button" size="icon-xs" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`}>
                  <ChevronLeft />
                </Button>
                <Button type="button" size="icon-xs" variant="ghost" className="text-white hover:bg-flare hover:text-white" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove page ${i + 1}`}>
                  <X />
                </Button>
                <Button type="button" size="icon-xs" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" onClick={() => move(i, i + 1)} disabled={i === value.length - 1} aria-label={`Move page ${i + 1} later`}>
                  <ChevronRight />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
