import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getRegions } from "@/lib/api/competition";
import { getTournamentHederaFields } from "@/lib/api/hedera";
import { HEDERA_ON } from "@/lib/hedera/mode";
import { TournamentForm } from "../tournament-form";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const [regions, hedera] = await Promise.all([getRegions(), HEDERA_ON ? getTournamentHederaFields(null) : null]);
  return (
    <>
      <PageHeader back={{ href: "/tournaments", label: "Tournaments" }} title="New tournament" />
      <TournamentForm regions={regions} hedera={hedera} />
    </>
  );
}
