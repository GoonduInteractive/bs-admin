import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getNoteStats, getNotes } from "@/lib/api/notes";
import { formatCount } from "@/lib/format";
import { NotesTable } from "./notes-table";

export const metadata: Metadata = { title: "Notes" };

/**
 * Community Wall moderation: every note players post, the queue first. A note
 * goes on the public wall only once it's approved. From the API's
 * `/v1/admin/notes` (`lib/api/notes.ts`).
 */
export default async function NotesPage() {
  const [notes, stats] = await Promise.all([getNotes(), getNoteStats()]);

  return (
    <>
      <PageHeader title="Notes" description="What players post to the Community Wall. A note goes on the wall only once it's approved." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Waiting for review"
          value={formatCount(stats.pending)}
          tone="warning"
          footer={stats.pending ? "Not on the wall until approved" : "All caught up"}
        />
        <StatCard label="On the wall" value={formatCount(stats.approved)} tone="success" footer="Approved, public" />
        <StatCard label="Rejected" value={formatCount(stats.rejected)} tone="danger" footer="Kept off the wall" />
        <StatCard label="Posted this week" value={formatCount(stats.postedThisWeek)} />
      </div>

      <SectionHeader title="All notes" />
      <NotesTable notes={notes} />
    </>
  );
}
