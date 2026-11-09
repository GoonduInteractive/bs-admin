"use client";

import { faCrown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Swords } from "lucide-react";
import { useTransition } from "react";
import { GiCrossedSwords } from "react-icons/gi";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";
import { ROUND } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BracketRound, Match, MatchSide } from "@/types";
import { recordResultAction } from "../actions";

function winnerOf(m: Match): 0 | 1 | null {
  return m.playedAt && m.winner !== undefined ? m.winner : null;
}

function Side({ side, won, lost, champion }: { side: MatchSide | null; won: boolean; lost: boolean; champion: boolean }) {
  return (
    <div className={cn("flex h-10 items-center justify-between gap-2 px-3 text-sm", lost && "text-muted-foreground line-through decoration-muted-foreground/40")}>
      <span className={cn("truncate", won && "font-semibold", (!side || side.bye) && "text-muted-foreground italic")}>
        {champion && <FontAwesomeIcon icon={faCrown} className="mr-1.5 text-gold" aria-label="Champion" />}
        {/* A bye is the dummy player: an empty seat that always loses. */}
        {side?.bye ? "Bye" : side ? `@${side.handle}` : "TBD"}
      </span>
      {side?.points !== undefined && <span className={cn("tabular", won && "font-semibold")}>{side.points.toLocaleString("en-NG")}</span>}
    </div>
  );
}

function MatchCard({ match, slug, isFinal }: { match: Match; slug: string; isFinal: boolean }) {
  const [pending, start] = useTransition();
  const w = winnerOf(match);
  const live = !!match.endsAt && !match.playedAt;
  const decided = match.sides[0] && match.sides[1];

  const record = (winner: 0 | 1) =>
    start(async () => {
      const res = await recordResultAction(slug, match.id, winner);
      if ("error" in res) toast.error(res.error);
      else toast.success(`@${match.sides[winner]!.handle} advances`);
    });

  return (
    <div className={cn("overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10", live && "ring-2 ring-signal/60")}>
      <Side side={match.sides[0]} won={w === 0} lost={w === 1} champion={isFinal && w === 0} />
      <div className="relative h-px bg-mist">
        <GiCrossedSwords aria-hidden className="absolute top-1/2 left-1/2 size-4 -translate-1/2 bg-card px-0.5 text-muted-foreground" />
      </div>
      <Side side={match.sides[1]} won={w === 1} lost={w === 0} champion={isFinal && w === 1} />
      <div className="flex items-center justify-between gap-2 border-t bg-paper/60 px-3 py-1.5 text-xs text-muted-foreground">
        {live ? (
          <span className="flex items-center gap-1.5 font-medium text-signal">
            <span className="size-1.5 animate-pulse rounded-full bg-signal" />
            Live · ends {formatDateTime(match.endsAt!)}
          </span>
        ) : match.walkover ? (
          <span>Automatic win: no opponent</span>
        ) : match.playedAt ? (
          <span>Played {formatDateTime(match.playedAt)}</span>
        ) : (
          <span>{match.scheduledAt ? formatDateTime(match.scheduledAt) : "Not scheduled"}</span>
        )}
        {!match.playedAt && decided && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="xs" variant="outline" className="h-6 bg-card" disabled={pending} />}>Result</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Who won?</DropdownMenuLabel>
                {([0, 1] as const).map((i) => (
                  <DropdownMenuItem key={i} onClick={() => record(i)}>
                    @{match.sides[i]!.handle}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/**
 * The bracket, one column per round. Each column spreads its matches across
 * the full height so a match sits level with the two it was fed from.
 */
export function Bracket({ rounds, slug, projected = [] }: { rounds: BracketRound[]; slug: string; projected?: { label: string; matches: number }[] }) {
  if (rounds.length === 0) {
    // The API says what the field will play once drawn.
    const ahead = projected.map((p) => `${p.label} (${p.matches} ${p.matches === 1 ? "match" : "matches"})`).join(" · ");
    return (
      <div className="rounded-xl bg-card ring-1 ring-foreground/8">
        <EmptyState
          icon={Swords}
          title="No bracket yet"
          description={
            ahead
              ? `The bracket is drawn when registration closes and seeding is done. With today's field it plays: ${ahead}.`
              : "The bracket is drawn when registration closes and seeding is done."
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card p-4 ring-1 ring-foreground/8 sm:p-6">
      <div className="flex min-w-max gap-6">
        {rounds.map((round, r) => (
          <section key={round.key} className="flex w-60 flex-col">
            <h3 className="mb-3 font-display text-xl leading-none font-semibold tracking-wide uppercase">
              {ROUND[round.key]}
              <span className="ml-2 font-sans text-xs font-normal tracking-normal text-muted-foreground normal-case">{round.matches.length} {round.matches.length === 1 ? "match" : "matches"}</span>
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {round.matches.map((m) => (
                <MatchCard key={m.id} match={m} slug={slug} isFinal={r === rounds.length - 1} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
