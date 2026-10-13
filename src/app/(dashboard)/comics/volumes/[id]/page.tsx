import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/api/client";
import { getComics, getProducts, getVolume } from "@/lib/api/merch";
import { volumeCompleteness } from "@/lib/comics";
import type { ComicProduct } from "@/types";
import { VolumeForm } from "../../volume-form";

export const metadata: Metadata = { title: "Edit volume" };

export default async function VolumePage({ params }: PageProps<"/comics/volumes/[id]">) {
  const { id } = await params;
  const volume = await getVolume(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [comics, products] = await Promise.all([getComics(), getProducts()]);
  const chapters = comics.filter((c) => c.volumeId === volume.id);
  // What the chapters cost bought one by one in print, to price the printed volume against.
  const printed = products.filter(
    (p): p is ComicProduct => p.type === "comics" && chapters.some((c) => c.id === p.comicId) && p.formats.physical.enabled,
  );
  const printSum = printed.length ? printed.reduce((s, p) => s + p.formats.physical.price, 0) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/comics", label: "Comics" }}
        title={`Vol. ${volume.number}: ${volume.title}`}
        description={`${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${chapters.reduce((s, c) => s + c.pages.length, 0)} pages`}
      />
      <VolumeForm volume={volume} chapters={chapters} completeness={volumeCompleteness(volume.id, comics)} printSum={printSum} />
    </>
  );
}
