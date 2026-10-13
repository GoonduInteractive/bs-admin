import { BookOpen, Eye, Library, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Thumb } from "@/components/shared/thumb";
import { Button } from "@/components/ui/button";
import { getComics, getProducts, getVolumes } from "@/lib/api/merch";
import { formatsOnSale, priceLabel, unitsSold, volumeCover } from "@/lib/comics";
import { formatCount, formatDate, formatNaira } from "@/lib/format";
import { COMIC_FORMAT, COMIC_STATUS, PRODUCT_STATUS } from "@/lib/labels";
import type { Comic, ComicProduct, ComicVolume } from "@/types";

export const metadata: Metadata = { title: "Comics" };

/**
 * The series, as it's organised: volumes, each collecting its chapters in
 * order. A chapter is one comic book - read online, sold online or in print.
 */
export default async function ComicsPage() {
  const [comics, volumes, products] = await Promise.all([getComics(), getVolumes(), getProducts()]);
  // How each chapter is sold is its `comics` product in Products, if it has one.
  const productFor = new Map(
    products.filter((p): p is ComicProduct => p.type === "comics").map((p) => [p.comicId, p]),
  );
  const sold = (id: string) => {
    const p = productFor.get(id);
    return p ? unitsSold(p) : 0;
  };
  const published = comics.filter((c) => c.status === "published");

  return (
    <>
      <PageHeader
        title="Comics"
        description="The Beyond Service comic series. Chapters are single comic books; they compile, in order, into volumes."
        actions={
          <>
            <Button size="xl" variant="outline" className="bg-card" render={<Link href="/comics/volumes/new" />}>
              <Library />
              New volume
            </Button>
            {volumes.length > 0 && (
              <Button size="xl" render={<Link href="/comics/new" />}>
                <Plus />
                Add chapter
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Volumes" value={formatCount(volumes.length)} footer={`${formatCount(comics.length)} chapters across them`} />
        <StatCard label="Published chapters" value={formatCount(published.length)} footer={`${comics.length - published.length} scheduled or in draft`} />
        <StatCard label="Reads" value={formatCount(comics.reduce((s, c) => s + c.reads, 0))} footer="Online reader, all chapters" />
        <StatCard
          label="Copies sold"
          value={formatCount(comics.reduce((s, c) => s + sold(c.id), 0))}
          footer={`${productFor.size} of ${comics.length} chapters in the store`}
        />
      </div>

      {volumes.length === 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/8">
          <EmptyState
            icon={BookOpen}
            title="No volumes yet"
            description="Create Volume 1, then add its chapters one comic book at a time."
            action={
              <Button size="xl" render={<Link href="/comics/volumes/new" />}>
                New volume
              </Button>
            }
          />
        </div>
      ) : (
        volumes.map((v) => (
          <VolumeSection
            key={v.id}
            volume={v}
            cover={volumeCover(v, comics)}
            chapters={comics.filter((c) => c.volumeId === v.id)}
            productFor={productFor}
            sold={sold}
          />
        ))
      )}
    </>
  );
}

/** One volume: its header, then its chapters in reading order. */
function VolumeSection({
  volume,
  cover,
  chapters,
  productFor,
  sold,
}: {
  volume: ComicVolume;
  cover?: string;
  chapters: Comic[];
  productFor: Map<string, ComicProduct>;
  sold: (id: string) => number;
}) {
  const live = chapters.filter((c) => c.status === "published").length;
  return (
    <section id={`vol-${volume.number}`} className="scroll-mt-20" aria-labelledby={`vol-${volume.id}-title`}>
      <header className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/8">
        <Link href={`/comics/volumes/${volume.id}`} className="relative aspect-4/5 w-16 shrink-0 overflow-hidden rounded-lg bg-entry">
          {cover && <Thumb src={cover} alt="" fill sizes="64px" className="object-cover object-top" />}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm leading-none tracking-wider text-signal uppercase">Volume {volume.number}</p>
          <h2 id={`vol-${volume.id}-title`} className="mt-1 font-display text-2xl leading-none font-semibold uppercase">
            {volume.title}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {chapters.length} chapter{chapters.length === 1 ? "" : "s"} · {live} published ·{" "}
            {formatCount(chapters.reduce((s, c) => s + c.pages.length, 0))} pages
          </p>
          {/* The printed volume: on sale, paused when the volume stopped being complete, or ready to switch on. */}
          {volume.edition?.enabled ? (
            <p className="mt-1 text-xs font-medium text-moss">
              Printed volume on sale · {formatNaira(volume.edition.price)} · {formatCount(volume.edition.stock)} in stock
            </p>
          ) : volume.edition?.pausedReason ? (
            <p className="mt-1 text-xs font-medium text-flare">Printed volume paused: {volume.edition.pausedReason}</p>
          ) : chapters.length > 0 && chapters.every((c) => c.status === "published") ? (
            <p className="mt-1 text-xs text-muted-foreground">Every chapter is out: it can be sold in print</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-card" render={<Link href={`/comics/volumes/${volume.id}`} />}>
            <Pencil />
            Edit volume
          </Button>
          <Button render={<Link href={`/comics/new?volume=${volume.id}`} />}>
            <Plus />
            Add chapter
          </Button>
        </div>
      </header>

      {chapters.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-mist px-4 py-10 text-center text-sm text-muted-foreground">
          No chapters in this volume yet.{" "}
          <Link href={`/comics/new?volume=${volume.id}`} className="font-medium text-signal hover:underline">
            Add Chapter 1
          </Link>
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {chapters.map((c) => (
            <ChapterCard key={c.id} c={c} product={productFor.get(c.id)} sold={sold(c.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ChapterCard({ c, product, sold }: { c: Comic; product?: ComicProduct; sold: number }) {
  const s = COMIC_STATUS[c.status];
  return (
    <li className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/8">
      <Link href={`/comics/${c.id}`} className="relative block aspect-[4/5] overflow-hidden bg-entry">
        <Thumb
          src={c.cover}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink via-ink/70 to-transparent p-4 pt-16 text-white">
          <span className="inline-block rounded bg-signal px-2 py-0.5 font-display text-sm leading-tight tracking-wider uppercase">
            Chapter {c.chapter}
          </span>
          <p className="mt-2 font-display text-3xl leading-none font-semibold uppercase">{c.title}</p>
        </div>
        <StatusBadge {...s} className="absolute top-3 left-3 shadow-sm" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-paper px-2 py-2">
            <dt className="text-muted-foreground">Pages</dt>
            <dd className="mt-0.5 text-sm font-semibold">{c.pages.length}</dd>
          </div>
          <div className="rounded-lg bg-paper px-2 py-2">
            <dt className="text-muted-foreground">Reads</dt>
            <dd className="mt-0.5 text-sm font-semibold">{formatCount(c.reads)}</dd>
          </div>
          <div className="rounded-lg bg-paper px-2 py-2">
            <dt className="text-muted-foreground">Sold</dt>
            <dd className="mt-0.5 text-sm font-semibold">{formatCount(sold)}</dd>
          </div>
        </dl>
        <StoreLine chapter={c} product={product} />
        <p className="text-xs text-muted-foreground">
          {c.status === "scheduled" && c.publishAt
            ? `Releases ${formatDate(c.publishAt)}`
            : c.publishAt
              ? `Released ${formatDate(c.publishAt)}`
              : `Edited ${formatDate(c.updatedAt)}`}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="outline" render={<Link href={`/comics/${c.id}/read`} />} disabled={c.pages.length === 0}>
            <Eye />
            Read
          </Button>
          <Button variant="outline" render={<Link href={`/comics/${c.id}`} />}>
            <Pencil />
            Edit
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Whether the chapter is sold in the store, and how - its `comics` product in Products. */
function StoreLine({ chapter, product }: { chapter: Comic; product?: ComicProduct }) {
  const comicId = chapter.id;
  if (!product) {
    return (
      <p className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Not in the store
        <Link href={`/products/new?type=comics&comic=${comicId}`} className="font-medium text-signal hover:underline">
          Add to store
        </Link>
      </p>
    );
  }
  const formats = formatsOnSale(product).map((f) => COMIC_FORMAT[f]).join(" + ") || "No format on sale";
  return (
    <Link href={`/products/${product.id}`} className="block rounded-lg bg-paper px-3 py-2 text-xs hover:bg-paper/70">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{formats}</span>
        <span className="tabular">{priceLabel(product)}</span>
      </span>
      <span className="text-muted-foreground">{saleLine(chapter, product)}</span>
    </Link>
  );
}

/** Where the listing stands, read with its chapter's release: it never sells before the chapter. */
function saleLine(chapter: Comic, product: ComicProduct): string {
  if (product.status !== "active") return `In the store · ${PRODUCT_STATUS[product.status].label}: not on sale`;
  if (chapter.status === "scheduled" && chapter.publishAt) return `On sale from ${formatDate(chapter.publishAt)}`;
  if (chapter.status === "draft") return "Waiting on the chapter: it's still a draft";
  return "On sale in the store";
}
