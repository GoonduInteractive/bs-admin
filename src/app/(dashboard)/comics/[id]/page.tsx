import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/api/client";
import { getComic, getComics, getProducts, getVolumes } from "@/lib/api/merch";
import { nextChapterNumber } from "@/lib/comics";
import { formatCount, formatDate } from "@/lib/format";
import { COMIC_STATUS } from "@/lib/labels";
import type { ComicProduct } from "@/types";
import { ComicForm, type ChapterSale } from "../comic-form";

export const metadata: Metadata = { title: "Edit chapter" };

export default async function ChapterPage({ params }: PageProps<"/comics/[id]">) {
  const { id } = await params;
  const comic = await getComic(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [comics, volumes, products] = await Promise.all([getComics(), getVolumes(), getProducts()]);
  const record = products.find((p): p is ComicProduct => p.type === "comics" && p.comicId === comic.id);
  const volume = volumes.find((v) => v.id === comic.volumeId);
  const nextChapter = Object.fromEntries(volumes.map((v) => [v.id, nextChapterNumber(comics, v.id)]));

  return (
    <>
      <PageHeader
        back={volume ? { href: `/comics/volumes/${volume.id}`, label: `Vol. ${volume.number}: ${volume.title}` } : { href: "/comics", label: "Comics" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Ch. {comic.chapter}: {comic.title}
            <StatusBadge {...COMIC_STATUS[comic.status]} className="font-sans text-xs tracking-normal normal-case" />
          </span>
        }
        description={`${volume ? `Vol. ${volume.number}, ${volume.title} · ` : ""}${comic.pages.length} pages · ${formatCount(comic.reads)} reads · last edited ${formatDate(comic.updatedAt)}`}
        actions={
          <Button variant="outline" size="xl" className="bg-card" render={<Link href={`/comics/${comic.id}/read`} />} disabled={comic.pages.length === 0}>
            <Eye />
            Open in reader
          </Button>
        }
      />
      <ComicForm comic={comic} volumes={volumes} nextChapter={nextChapter} sale={record && saleOf(record)} />
    </>
  );
}

/** The chapter's store record as the chapter form needs it: on sale or not, and its prices to pre-fill. */
function saleOf(p: ComicProduct): ChapterSale {
  const { online, physical } = p.formats;
  return {
    priced: p.status === "active" && (online.enabled || physical.enabled),
    formats: {
      online: { enabled: online.enabled, free: online.free, price: online.free ? "" : String(online.price) },
      physical: { enabled: physical.enabled, price: String(physical.price), stock: physical.stock },
    },
  };
}
