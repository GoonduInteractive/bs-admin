import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a page's data loads. Shaped like the typical page: title, stat row, table. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-10 w-56 bg-mist/60" />
        <Skeleton className="h-4 w-80 bg-mist/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl bg-card" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl bg-card" />
    </div>
  );
}
