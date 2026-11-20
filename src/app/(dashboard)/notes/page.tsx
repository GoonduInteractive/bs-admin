import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getModerationReports, getNoteStats, getNotes } from "@/lib/api/notes";
import { formatCount } from "@/lib/format";
import type { ModerationReport } from "@/types";
import { NotesTable } from "./notes-table";
import { ReportsTable } from "./reports-table";

export const metadata: Metadata = { title: "Notes" };

/** The reports are new and undocumented: a reply this page can't read leaves the section out, not the page. */
async function reportsOrNone(): Promise<ModerationReport[] | null> {
  try {
    return await getModerationReports();
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
}

/**
 * Community Wall moderation (`lib/api/notes.ts`). A note goes up the moment a
 * player posts it; the API's automatic check takes off any that break a
 * community rule, and those wait here, flagged, for an admin to restore or
 * take down. Self-harm flags come first. Above them, when there are any, the
 * notes the website refused outright and reported (self-harm, underage).
 */
export default async function NotesPage() {
  const [notes, stats, reports] = await Promise.all([getNotes(), getNoteStats(), reportsOrNone()]);
  const openReports = reports?.filter((r) => r.status === "open").length ?? 0;

  return (
    <>
      <PageHeader
        title="Notes"
        description="What players post to the Community Wall. Notes go up straight away; the automatic check takes off any that break a rule, and they wait here for you."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Flagged for review"
          value={formatCount(stats.flagged)}
          tone="warning"
          footer={
            stats.urgent
              ? `${formatCount(stats.urgent)} urgent: reach out personally`
              : stats.flagged
                ? "Off the wall until you restore or take them down"
                : "All caught up"
          }
        />
        <StatCard label="Being checked" value={formatCount(stats.pendingCheck)} footer="Live, queued for the automatic check" />
        <StatCard label="On the wall" value={formatCount(stats.onWall)} tone="success" footer="Public right now" />
        <StatCard label="Taken down" value={formatCount(stats.rejected)} tone="danger" footer="Kept off the wall" />
        <StatCard label="Posted this week" value={formatCount(stats.postedThisWeek)} />
      </div>

      {reports && reports.length > 0 && (
        <>
          <SectionHeader title={openReports ? `Reported from the website (${formatCount(openReports)} to follow up)` : "Reported from the website"} />
          <ReportsTable reports={reports} />
        </>
      )}

      <SectionHeader title="All notes" />
      <NotesTable notes={notes} />
    </>
  );
}
