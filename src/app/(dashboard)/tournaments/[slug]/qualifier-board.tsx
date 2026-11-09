import { Panel } from "@/components/shared/panel";
import { formatCount, formatDateTime } from "@/lib/format";
import { QUALIFY_CUT, qualifierRanking } from "@/lib/tournaments";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";

/**
 * Qualifiers: too many players for a bracket, so they play on a leaderboard
 * during the window. Points come from the game. When the admin moves on, the
 * top 32 go into the Group stage and everyone below the line is out.
 *
 * The board is the API's (`qualifier` on the bracket, since 2026-11-02): its
 * ranks, its cutoff and who goes through. A reply without one is ranked here,
 * the same way.
 */
export function QualifierBoard({ tournament: t }: { tournament: Tournament }) {
  const stage = t.stages.find((s) => s.key === "qualifiers");
  const cutoff = t.qualifier?.cutoff ?? QUALIFY_CUT;
  const rows =
    t.qualifier?.entries ??
    qualifierRanking(t.participants.filter((p) => p.status === "active")).map((p, i) => ({
      rank: i + 1,
      playerId: p.playerId,
      handle: p.handle,
      points: p.points,
      through: i < QUALIFY_CUT,
    }));
  const lastThrough = rows.findLastIndex((r) => r.through);

  return (
    <Panel
      title="Qualifier leaderboard"
      description={
        <>
          {formatCount(rows.length)} players · the top {cutoff} go through to the Group stage
          {stage?.startsAt && stage.endsAt && ` · ${formatDateTime(stage.startsAt)} to ${formatDateTime(stage.endsAt)}`}
        </>
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-paper text-muted-foreground">
            <tr>
              <th className="w-16 px-3 py-2.5 text-left font-medium">Rank</th>
              <th className="px-3 py-2.5 text-left font-medium">Player</th>
              <th className="px-3 py-2.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.playerId}
                className={cn(
                  "border-t",
                  !r.through && "text-muted-foreground",
                  // The cut: everyone above this line goes through.
                  i === lastThrough + 1 && lastThrough >= 0 && "border-t-2 border-t-signal",
                )}
              >
                <td className="px-3 py-2 tabular">{r.rank}</td>
                <td className="px-3 py-2 font-medium">
                  @{r.handle}
                  {i === lastThrough && i < rows.length - 1 && <span className="ml-2 text-xs font-normal text-signal">last place through</span>}
                </td>
                <td className="px-3 py-2 text-right tabular">{formatCount(r.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ties go to whoever registered first.</p>
    </Panel>
  );
}
