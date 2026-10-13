import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getRegions } from "@/lib/api/competition";
import { TournamentForm } from "../tournament-form";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const regions = await getRegions();
  return (
    <>
      <PageHeader back={{ href: "/tournaments", label: "Tournaments" }} title="New tournament" />
      <TournamentForm regions={regions} />
    </>
  );
}
