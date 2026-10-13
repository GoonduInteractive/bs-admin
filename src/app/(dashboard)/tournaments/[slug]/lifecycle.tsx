"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { STAGE } from "@/lib/labels";
import { fromLagosInput } from "@/lib/lagos-time";
import { QUALIFY_CUT, bracketSize, firstRound, stagePosition, unplayed } from "@/lib/tournaments";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";
import { advanceStageAction, setStatusAction } from "../actions";

/** The one button that moves a tournament forward, plus cancel. */
export function Lifecycle({ tournament }: { tournament: Tournament }) {
  const [pending, start] = useTransition();
  const { slug, status, stages } = tournament;
  const run = (fn: () => Promise<{ ok: true } | { error: string } | undefined | void>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res && "error" in res) toast.error(res.error);
      else toast.success(done);
    });

  const cancel =
    status !== "completed" && status !== "cancelled" ? (
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="xl" className="bg-card" disabled={pending}>
            Cancel tournament
          </Button>
        }
        title={`Cancel ${tournament.name}?`}
        description="Players who registered are notified by email."
        confirmLabel="Cancel tournament"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => run(() => setStatusAction(slug, "cancelled"), "Tournament cancelled")}
      />
    ) : null;

  let primary: React.ReactNode = null;
  const spinner = pending && <Loader2 className="animate-spin" />;

  if (status === "draft") {
    primary = (
      <>
        <Button variant="outline" size="xl" className="bg-card" disabled={pending} onClick={() => run(() => setStatusAction(slug, "comingSoon"), "Announced as coming soon")}>
          Announce
        </Button>
        <Button size="xl" disabled={pending || !tournament.startsAt} onClick={() => run(() => setStatusAction(slug, "registrationOpen"), "Registration is open")}>
          {spinner}
          Open registration
        </Button>
      </>
    );
  } else if (status === "comingSoon") {
    primary = (
      <Button size="xl" disabled={pending || !tournament.startsAt} onClick={() => run(() => setStatusAction(slug, "registrationOpen"), "Registration is open")}>
        {spinner}
        Open registration
      </Button>
    );
  } else if (status === "registrationOpen" || status === "active") {
    const { current } = stagePosition(stages);
    const finalOpen = current?.key === "finals";
    primary = finalOpen ? (
      <ConfirmDialog
        trigger={
          <Button size="xl" variant="brand" disabled={pending || unplayed(tournament.bracket.find((r) => r.key === "finals")) > 0}>
            {spinner}
            Complete tournament
          </Button>
        }
        title={`Complete ${tournament.name}?`}
        description="The Final has its result. Completing crowns the champion and closes the tournament."
        confirmLabel="Complete tournament"
        onConfirm={() => run(() => advanceStageAction(slug), "Tournament complete")}
      />
    ) : (
      <AdvanceDialog tournament={tournament} pending={pending} onAdvance={(when, done) => run(() => advanceStageAction(slug, when), done)} />
    );
  }
  return (
    <>
      {cancel}
      {primary}
    </>
  );
}

/** Whether a Lagos-time `datetime-local` value is already past. Read when the admin confirms, not while rendering. */
function isPast(local: string) {
  return new Date(fromLagosInput(local)).getTime() < Date.now();
}

/** What moving on will do, worked out before anything changes. */
function preview(t: Tournament) {
  const { current, next } = stagePosition(t.stages);
  const field = t.participants.filter((p) => p.status === "registered" || p.status === "active").length;

  if (!current || current.key === "registration") {
    if (field < 2) return { blocker: "At least 2 players are needed to start." };
    if (field > QUALIFY_CUT) {
      return {
        title: "Close registration and start Qualifiers",
        body: `${field} players registered: more than ${QUALIFY_CUT}, so it opens with a qualifier leaderboard. The top ${QUALIFY_CUT} go through to the Group stage.`,
        window: true,
        done: "Registration closed. Qualifiers are set",
      };
    }
    const size = bracketSize(field);
    const first = firstRound(size);
    const byes = size - field;
    return {
      title: `Close registration and start the ${STAGE[first]}`,
      body:
        `${field} players: a bracket of ${size}, starting at the ${STAGE[first].toLowerCase()}. Qualifiers aren't needed.` +
        (byes ? ` ${byes} empty ${byes === 1 ? "seat is a bye" : "seats are byes"}: the top seeds drawn against them win automatically.` : ""),
      done: `Registration closed. The ${STAGE[first].toLowerCase()} is set`,
    };
  }

  if (current.key === "qualifiers") {
    const n = t.participants.filter((p) => p.status === "active").length;
    return {
      title: "Close Qualifiers and start the Group stage",
      body: `The top ${Math.min(QUALIFY_CUT, n)} of ${n} on the qualifier leaderboard go into the Group stage. Everyone below ${QUALIFY_CUT === 32 ? "32nd" : QUALIFY_CUT} place is out.`,
      done: "Qualifiers closed. The Group stage is set",
    };
  }

  const left = unplayed(t.bracket.find((r) => r.key === current.key));
  if (left) return { blocker: `${left} ${left === 1 ? "match" : "matches"} in the ${STAGE[current.key].toLowerCase()} still ${left === 1 ? "needs" : "need"} a result. Record ${left === 1 ? "it" : "them"} on the Bracket tab first.` };
  if (!next) return { blocker: "There is no next stage." };
  const matches = t.bracket.find((r) => r.key === next.key)?.matches.length ?? 0;
  return {
    title: `Start the ${STAGE[next.key]}`,
    body: `The ${STAGE[current.key].toLowerCase()} is done. The ${STAGE[next.key].toLowerCase()} has ${matches} ${matches === 1 ? "match" : "matches"}.`,
    done: `The ${STAGE[next.key].toLowerCase()} is set`,
  };
}

/**
 * "Move to next stage": rounds never advance on their own. The admin picks
 * when the next stage starts - and for Qualifiers when the window closes - so
 * players see the time well before it begins.
 */
function AdvanceDialog({
  tournament,
  pending,
  onAdvance,
}: {
  tournament: Tournament;
  pending: boolean;
  onAdvance: (when: { startsAt: string; endsAt?: string }, done: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const p = preview(tournament);
  const isRegistration = tournament.status === "registrationOpen";

  function confirm() {
    if (p.blocker) return;
    if (!startsAt) return setError("Pick when it starts");
    if (isPast(startsAt)) return setError("Pick a time in the future, so players get notice");
    if (p.window && !endsAt) return setError("Pick when the qualifier window closes");
    if (p.window && endsAt <= startsAt) return setError("The window must close after it opens");
    setOpen(false);
    onAdvance({ startsAt, endsAt: p.window ? endsAt : undefined }, p.done!);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setStartsAt("");
          setEndsAt("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button size="xl" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {isRegistration ? "Close registration & start" : "Move to next stage"}
            {!isRegistration && <ArrowRight />}
          </Button>
        }
      />
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{p.blocker ? "Not ready to move on" : p.title}</AlertDialogTitle>
          <AlertDialogDescription>{p.blocker ?? p.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {!p.blocker && (
          <FieldGroup className="gap-4">
            <div className={cn("grid gap-3", p.window && "sm:grid-cols-2")}>
              <Field data-invalid={!!error && !startsAt}>
                <FieldLabel htmlFor="next-starts">{p.window ? "Qualifiers open" : "Starts"} (Lagos time)</FieldLabel>
                <Input id="next-starts" type="datetime-local" className="h-10" value={startsAt} onChange={(e) => { setStartsAt(e.target.value); setError(null); }} />
              </Field>
              {p.window && (
                <Field>
                  <FieldLabel htmlFor="next-ends">Qualifiers close (Lagos time)</FieldLabel>
                  <Input id="next-ends" type="datetime-local" className="h-10" value={endsAt} onChange={(e) => { setEndsAt(e.target.value); setError(null); }} />
                </Field>
              )}
            </div>
            <FieldDescription>Players see this time on the tournament page, so give them notice.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{p.blocker ? "Close" : "Cancel"}</AlertDialogCancel>
          {!p.blocker && (
            <Button type="button" onClick={confirm}>
              {isRegistration ? "Close registration & start" : "Start stage"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
