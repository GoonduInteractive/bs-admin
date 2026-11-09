import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/api/client";
import { getComics, getVolume } from "@/lib/api/merch";
import { VolumeForm } from "../../volume-form";

export const metadata: Metadata = { title: "Edit volume" };

export default async function VolumePage({ params }: PageProps<"/comics/volumes/[id]">) {
  const { id } = await params;
  const volume = await getVolume(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const chapters = (await getComics()).filter((c) => c.volumeId === volume.id);

  return (
    <>
      <PageHeader
        back={{ href: "/comics", label: "Comics" }}
        title={`Vol. ${volume.number}: ${volume.title}`}
        description={`${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${chapters.reduce((s, c) => s + c.pages.length, 0)} pages`}
      />
      <VolumeForm volume={volume} chapters={chapters} />
    </>
  );
}
