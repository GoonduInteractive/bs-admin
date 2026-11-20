"use client";

import { Undo2 } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { SeedsEntry, SeedsLedger } from "@/types";
import { getSeedsAction, reverseSeedsAction } from "./actions";

/** A labelled figure in the player panel. */
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

/** The API's words, readable: "comic_read" is "Comic read". */
function words(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text && text[0].toUpperCase() + text.slice(1);
}

/** The statuses aren't listed in the spec, so the tone is read from the word. */
function toneOf(status: string): Tone {
  if (/pend|hold/i.test(status)) return "warning";
  if (/revers|void|cancel|fail/i.test(status)) return "danger";
  if (/avail|settl|clear|complete|post|credit/i.test(status)) return "success";
  return "neutral";
}

/** Only Seeds that came in can go back out, and only once. The API has the last word. */
const reversible = (e: SeedsEntry) => e.direction === "credit" && !/revers/i.test(`${e.status} ${e.kind}`);

/**
 * A player's Seeds in their profile panel: the usable Seeds (what's in the
 * Calabash, the wallet), what's on hold, the Legacy Seeds (all time), and the
 * latest entries, newest first. A
 * credit can be reversed (Seeds earned by mistake or by cheating), with a
 * reason for the record. Read when the panel opens; render it with
 * `key={playerId}` so another player starts from blank.
 */
export function PlayerSeeds({ playerId, handle }: { playerId: string; handle: string }) {
  const [ledger, setLedger] = useState<SeedsLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reversing, setReversing] = useState<SeedsEntry | null>(null);
  const [pending, start] = useTransition();
  const headingId = useId();

  useEffect(() => {
    let current = true;
    void getSeedsAction(playerId).then((res) => {
      if (!current) return;
      if ("error" in res) setError(res.error);
      else setLedger(res.ledger);
    });
    return () => {
      current = false;
    };
  }, [playerId]);

  const reverse = (entry: SeedsEntry, reason: string) =>
    start(async () => {
      const res = await reverseSeedsAction(playerId, entry.id, reason);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setLedger(res.ledger);
      toast.success(`${formatCount(res.reversed)} Seeds taken back from @${handle}`);
    });

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-sm font-medium">
        Seeds
      </h3>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {error}
        </p>
      ) : !ledger ? (
        <div aria-busy className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Usable" value={formatCount(ledger.calabash)} />
              <Stat label="On hold" value={formatCount(ledger.pending)} />
              <Stat label="Legacy" value={formatCount(ledger.legacy)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Usable Seeds are what they can spend now, held in their Calabash. On hold are earned but not spendable yet. Legacy Seeds are
              every Seed they&apos;ve ever earned; spending never lowers it.
            </p>
          </div>

          {ledger.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Seeds earned or spent yet.</p>
          ) : (
            <ul aria-busy={pending || undefined} className="divide-y rounded-lg border text-sm">
              {ledger.entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{words(e.source) || words(e.kind) || "Seeds"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[e.source && words(e.kind), formatDateTime(e.createdAt)].filter(Boolean).join(" · ")}
                    </p>
                    {e.availableAt && /pend|hold/i.test(e.status) && (
                      <p className="text-xs text-muted-foreground">Spendable from {formatDate(e.availableAt)}</p>
                    )}
                    {e.reference && <p className="truncate font-mono text-xs text-muted-foreground">{e.reference}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn("font-semibold tabular-nums", e.direction === "credit" ? "text-moss" : "text-flare")}>
                      {e.direction === "credit" ? "+" : "−"}
                      {formatCount(e.amount)}
                    </span>
                    {e.status && <StatusBadge label={words(e.status)} tone={toneOf(e.status)} />}
                    {reversible(e) && (
                      <Button variant="ghost" size="xs" disabled={pending} onClick={() => setReversing(e)}>
                        <Undo2 />
                        Reverse
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ReverseDialog entry={reversing} handle={handle} onClose={() => setReversing(null)} onConfirm={reverse} />
    </section>
  );
}

/** Asks why before Seeds are taken back. The reason is optional to the API, so here too. */
function ReverseDialog({
  entry,
  handle,
  onClose,
  onConfirm,
}: {
  entry: SeedsEntry | null;
  handle: string;
  onClose: () => void;
  onConfirm: (entry: SeedsEntry, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const reasonId = useId();

  const close = () => {
    setReason("");
    onClose();
  };
  const confirm = () => {
    if (!entry) return;
    onConfirm(entry, reason.trim());
    close();
  };

  return (
    <AlertDialog open={!!entry} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reverse {entry ? formatCount(entry.amount) : ""} Seeds?</AlertDialogTitle>
          <AlertDialogDescription>
            They come out of @{handle}&apos;s Calabash. Use it for Seeds earned by mistake or by breaking the rules.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Credited twice for the same match"
          />
          <FieldDescription>Kept with the reversal, for the record.</FieldDescription>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Reverse
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
