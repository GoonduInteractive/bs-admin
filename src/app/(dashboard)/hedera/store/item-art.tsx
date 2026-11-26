import { Gem } from "lucide-react";
import { Thumb } from "@/components/shared/thumb";
import { cn } from "@/lib/utils";

/** An exclusive's picture, or an outlined gem where there's none yet. */
export function ItemArt({ src, alt, size = 40, className }: { src: string; alt: string; size?: number; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-paper", className)} style={{ width: size, height: size }}>
      {src ? (
        <Thumb src={src} alt={alt} fill sizes={`${size}px`} className="object-cover object-top" />
      ) : (
        <Gem className="size-1/2 stroke-[1.25] text-muted-foreground" aria-label="No picture yet" />
      )}
    </span>
  );
}
