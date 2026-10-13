import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/api/auth";
import { NotFoundError } from "@/lib/api/client";
import { getComic, getComics, getVolumes } from "@/lib/api/merch";
import { Reader } from "./reader";

export const metadata: Metadata = { title: "Reader" };

/**
 * The comic reader, full screen and outside the dashboard chrome - the same
 * experience a player gets, so the team can proof a chapter before release.
 */
export default async function ReadPage({ params }: PageProps<"/comics/[id]/read">) {
  if (!(await getCurrentAdmin())) redirect("/login");
  const { id } = await params;
  const comic = await getComic(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  if (comic.pages.length === 0) redirect(`/comics/${comic.id}`);

  // Chapters read on, in order, through the volume and into the next one.
  const [chapters, volumes] = await Promise.all([getComics(), getVolumes()]);
  const volume = volumes.find((v) => v.id === comic.volumeId);
  const at = chapters.findIndex((c) => c.id === comic.id);
  const next = chapters.slice(at + 1).find((c) => c.pages.length > 0);
  const nextVolume = next && volumes.find((v) => v.id === next.volumeId);

  return (
    <Reader
      comic={comic}
      volume={volume}
      next={next && { id: next.id, label: next.volumeId === comic.volumeId ? `Chapter ${next.chapter}: ${next.title}` : `Vol. ${nextVolume?.number}, Chapter ${next.chapter}: ${next.title}` }}
    />
  );
}
