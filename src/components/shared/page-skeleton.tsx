import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a detail or form page is opened, while its data loads:
 * each such route's `loading.tsx`. Shaped like those pages - back link, title,
 * a wide column of panels and a narrow one beside it.
 *
 * WHY EACH ROUTE HAS ITS OWN. Next shows a `loading.tsx` only when the segment
 * below it changes, so the dashboard's (`(dashboard)/loading.tsx`) covers a
 * move between sections but not Orders -> an order: there the list stayed on
 * screen, with no sign anything was happening, until the order arrived.
 */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 bg-mist/60" />
        <Skeleton className="h-10 w-72 bg-mist/60" />
        <Skeleton className="h-4 w-96 max-w-full bg-mist/60" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl bg-card" />
          <Skeleton className="h-48 rounded-xl bg-card" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-xl bg-card" />
          <Skeleton className="h-32 rounded-xl bg-card" />
        </div>
      </div>
    </div>
  );
}
