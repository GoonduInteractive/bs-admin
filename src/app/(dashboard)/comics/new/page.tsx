import type { Metadata } from "next";
import { Library } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getComics, getCoverStylesSaved, getVolumes } from "@/lib/api/merch";
import { nextChapterNumber } from "@/lib/comics";
import { ComicForm } from "../comic-form";

export const metadata: Metadata = { title: "Add chapter" };

/** `?volume=<id>` pre-picks the volume - how a volume's "Add chapter" lands here. */
export default async function NewChapterPage({ searchParams }: PageProps<"/comics/new">) {
  const { volume } = await searchParams;
  const [comics, volumes, coverStyles] = await Promise.all([getComics(), getVolumes(), getCoverStylesSaved()]);
  const nextChapter = Object.fromEntries(volumes.map((v) => [v.id, nextChapterNumber(comics, v.id)]));
  const start = typeof volume === "string" && volumes.some((v) => v.id === volume) ? volume : undefined;

  return (
    <>
      <PageHeader back={{ href: "/comics", label: "Comics" }} title="Add chapter" description="Pick its volume, add the cover and the pages in order, and choose when it goes live." />
      {volumes.length === 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/8">
          <EmptyState
            icon={Library}
            title="Create a volume first"
            description="Every chapter is compiled into a volume. Create Volume 1, then add its chapters."
            action={
              <Button size="xl" render={<Link href="/comics/volumes/new" />}>
                New volume
              </Button>
            }
          />
        </div>
      ) : (
        <ComicForm volumes={volumes} nextChapter={nextChapter} startVolumeId={start} coverStyles={coverStyles} />
      )}
    </>
  );
}
