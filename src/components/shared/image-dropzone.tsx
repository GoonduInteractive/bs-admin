"use client";

import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCEPT_IMAGES, uploadImage } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { Thumb } from "./thumb";

/** One image: drop or pick a file, it uploads, and the field holds its URL. */
export function ImageDropzone({
  value,
  onChange,
  label = "Drop an image here, or browse",
  hint = "PNG, JPG or WebP, up to 15 MB",
  aspect = "aspect-square",
  fit = "object-contain",
  invalid,
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  aspect?: string;
  fit?: "object-contain" | "object-cover";
  invalid?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  }

  return (
    <div className={className}>
      <input ref={input} type="file" accept={ACCEPT_IMAGES} className="sr-only" tabIndex={-1} onChange={(e) => take(e.target.files?.[0])} />
      {value ? (
        <div className={cn("group relative overflow-hidden rounded-xl bg-linen ring-1 ring-foreground/8", aspect)}>
          <Thumb src={value} alt="" fill sizes="400px" className={cn(fit, fit === "object-contain" && "p-4")} />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-linear-to-t from-ink/60 to-transparent p-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Replace
            </Button>
            <Button type="button" size="icon-sm" variant="secondary" onClick={() => onChange("")} aria-label="Remove image">
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          disabled={busy}
          data-invalid={invalid || undefined}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist bg-paper/50 p-6 text-center transition-colors hover:border-slate/40 hover:bg-paper",
            over && "border-signal bg-blush/40",
            invalid && "border-flare",
            aspect,
          )}
        >
          {busy ? <Loader2 className="size-8 animate-spin text-muted-foreground" /> : <ImagePlus className="size-8 stroke-[1.5] text-muted-foreground" />}
          <span className="text-sm font-medium">{busy ? "Uploading…" : label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </button>
      )}
    </div>
  );
}
