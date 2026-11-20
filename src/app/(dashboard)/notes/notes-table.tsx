"use client";

import { ArchiveX, MoreHorizontal, RotateCcw, ShieldAlert, StickyNote } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCount, formatDateTime, initials } from "@/lib/format";
import { NOTE_RULES, NOTE_STATUS, noteRuleKey, noteRuleLabel } from "@/lib/labels";
import type { Note } from "@/types";
import { moderateNoteAction } from "./actions";

/** "@handle", or the player's name when they have no username yet. */
const who = (n: Note) => (n.author.handle ? `@${n.author.handle}` : n.author.name);
const authorKey = (n: Note) => n.author.handle ?? `name:${n.author.name}`;

/** What took a note down (`flag_source`). */
const SOURCE: Record<NonNullable<Note["source"]>, string> = {
  auto_check: "The automatic check",
  client_report: "The website (blocked and reported)",
  manual: "An admin",
};

/** The rules a take-down can name: every one but self-harm, whose player isn't emailed. */
const PICKABLE = NOTE_RULES.filter((r) => r.key !== "self_harm");

/** The rules a flagged note matched, once each, as labels. */
const flaggedFor = (n: Note) => [...new Set(n.matches.map((m) => noteRuleLabel(m.rule)))];

/** The take-down's rule, ready-chosen from what the check found; none for self-harm. */
function suggestedRule(n: Note): string | null {
  for (const m of n.matches) {
    const label = PICKABLE.find((r) => r.key === noteRuleKey(m.rule))?.label;
    if (label) return label;
  }
  return null;
}

/** Restore goes straight through; a take-down asks which rule first (`TakeDownDialog`). */
function useModerate(n: Note) {
  const [pending, start] = useTransition();
  const [askingRule, setAskingRule] = useState(false);

  const restore = () =>
    start(async () => {
      const res = await moderateNoteAction(n.id, "approved");
      if ("error" in res) toast.error(res.error);
      else toast.success(`Restored: ${who(n)}'s note is back on the wall`);
    });
  const takeDown = (rule: string | null) =>
    start(async () => {
      const res = await moderateNoteAction(n.id, "rejected", rule ?? undefined);
      if ("error" in res) toast.error(res.error);
      else {
        setAskingRule(false);
        toast.success(`Taken down: ${who(n)}'s note is off the wall`);
      }
    });
  return { pending, restore, takeDown, askingRule, askRule: () => setAskingRule(true), closeRule: () => setAskingRule(false) };
}

function TakeDownDialog({
  n,
  open,
  pending,
  onClose,
  onConfirm,
}: {
  n: Note;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (rule: string | null) => void;
}) {
  const [rule, setRule] = useState<string | null>(() => suggestedRule(n));
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Take {who(n)}&apos;s note down?</AlertDialogTitle>
          <AlertDialogDescription>
            {n.urgent
              ? "This note matched self-harm. It comes off the wall and the player isn't emailed: reach out to them personally instead."
              : "It comes off the wall, and the player is emailed that it broke the rule you choose. You can restore it later."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!n.urgent && (
          <Field>
            <FieldLabel htmlFor={`rule-${n.id}`}>Rule it broke</FieldLabel>
            <Select value={rule} onValueChange={(v) => setRule(v as string)}>
              <SelectTrigger id={`rule-${n.id}`} className="w-full data-[size=default]:h-10">
                <SelectValue>{(v: string | null) => v ?? "Choose a rule"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PICKABLE.map((r) => (
                  <SelectItem key={r.key} value={r.label}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>The player sees this in the email, never the words that tripped the check.</FieldDescription>
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending || (!n.urgent && !rule)} onClick={() => onConfirm(n.urgent ? null : rule)}>
            Take down
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A flagged note's two calls sit on the row; everything else is in the menu. */
function RowActions({ n, onView }: { n: Note; onView: () => void }) {
  const m = useModerate(n);
  return (
    <div className="flex items-center justify-end gap-1">
      {/* Icons, so both calls and the menu fit beside the columns; each names itself on hover and to a screen reader. */}
      {n.status === "flagged" && (
        <>
          <Button
            size="icon-sm"
            variant="outline"
            className="bg-card text-moss hover:bg-moss-soft hover:text-moss"
            disabled={m.pending}
            onClick={m.restore}
            aria-label={`Restore ${who(n)}'s note`}
            title="Restore"
          >
            <RotateCcw />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="bg-card text-flare hover:bg-flare-soft hover:text-flare"
            disabled={m.pending}
            onClick={m.askRule}
            aria-label={`Take down ${who(n)}'s note`}
            title="Take down"
          >
            <ArchiveX />
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`More actions for ${who(n)}'s note`} disabled={m.pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onView}>View note</DropdownMenuItem>
          {n.status === "rejected" && (
            <DropdownMenuItem onClick={m.restore}>
              <RotateCcw />
              Restore
            </DropdownMenuItem>
          )}
          {(n.status === "approved" || n.status === "pending") && (
            <DropdownMenuItem onClick={m.askRule}>
              <ArchiveX />
              Take off the wall
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {m.askingRule && <TakeDownDialog n={n} open pending={m.pending} onClose={m.closeRule} onConfirm={m.takeDown} />}
    </div>
  );
}

function NoteSheet({ note, pastFlags, onClose }: { note: Note | null; pastFlags: number; onClose: () => void }) {
  return (
    <Sheet open={!!note} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">{note && <NoteDetail key={note.id} n={note} pastFlags={pastFlags} />}</SheetContent>
    </Sheet>
  );
}

function NoteDetail({ n, pastFlags }: { n: Note; pastFlags: number }) {
  const m = useModerate(n);
  const live = n.status === "approved" || n.status === "pending";
  // Came off the wall at some point (now, or flagged then restored): only then is the source what took it down.
  const cameDown = n.status === "flagged" || n.status === "rejected" || !!n.flaggedAt;
  // Never came down: the check passed it (it ran, or the API names it), or it hasn't run yet.
  const check = cameDown
    ? null
    : n.checkedAt
      ? `Passed, ${formatDateTime(n.checkedAt)}`
      : n.source === "auto_check"
        ? "Passed"
        : n.status === "pending"
          ? "Not run yet"
          : null;
  const facts = (
    [
      ["Posted", formatDateTime(n.postedAt)],
      ["Likes", live ? formatCount(n.likes) : "—"],
      ["Flagged", n.flaggedAt && formatDateTime(n.flaggedAt)],
      ["Taken down by", cameDown && n.source && SOURCE[n.source]],
      ["Automatic check", check],
      ["Checked against", n.rulesVersion && `Rules v${n.rulesVersion}`],
      ["Past flags", `${formatCount(pastFlags)} ${pastFlags === 1 ? "note" : "notes"} by this player`],
      ["Moderated by", n.moderatedBy],
      ["Moderated", n.moderatedAt && formatDateTime(n.moderatedAt)],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => v);

  return (
    <>
      <SheetHeader className="border-b p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-12">
            <AvatarFallback className="bg-entry font-display text-lg text-white">{initials(n.author.name)}</AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="text-lg">{who(n)}</SheetTitle>
            {n.author.handle && <SheetDescription>{n.author.name}</SheetDescription>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge {...NOTE_STATUS[n.status]} />
              {n.urgent && <StatusBadge label="Urgent" tone="danger" hint="Matched self-harm: reach out to the player personally." />}
            </div>
          </div>
        </div>
      </SheetHeader>
      <div className="space-y-5 overflow-y-auto p-6">
        {n.urgent && (
          <p className="flex gap-2.5 rounded-lg bg-flare-soft p-3 text-sm text-flare">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            This note matched self-harm. The player isn&apos;t emailed if it&apos;s taken down: reach out to them personally.
          </p>
        )}
        {/* The note as written: what goes on the wall, word for word. */}
        <blockquote className="rounded-lg bg-paper p-4 text-base leading-relaxed whitespace-pre-line">{n.body}</blockquote>
        {n.matches.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">What the check found</h3>
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {n.matches.map((match, i) => (
                <li key={`${match.rule}-${match.entry}-${i}`} className="flex justify-between gap-4 px-3 py-2">
                  <span className="text-muted-foreground">{noteRuleLabel(match.rule)}</span>
                  {match.entry && <span className="text-right font-medium break-all">{match.entry}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {n.exempt && <p className="text-sm text-muted-foreground">Restored before, so the automatic check skips it.</p>}
        <dl className="divide-y text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2">
          {(n.status === "flagged" || n.status === "rejected") && (
            <Button size="xl" disabled={m.pending} onClick={m.restore}>
              <RotateCcw />
              Restore
            </Button>
          )}
          {n.status !== "rejected" && (
            <Button variant="outline" size="xl" disabled={m.pending} onClick={m.askRule}>
              <ArchiveX />
              {n.status === "flagged" ? "Take down" : "Take off the wall"}
            </Button>
          )}
          <Button variant="outline" size="xl" render={<Link href={`/players?q=${encodeURIComponent(n.author.handle ?? n.author.name)}`} />}>
            View player
          </Button>
        </div>
      </div>
      {m.askingRule && <TakeDownDialog n={n} open pending={m.pending} onClose={m.closeRule} onConfirm={m.takeDown} />}
    </>
  );
}

export function NotesTable({ notes }: { notes: Note[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = notes.find((n) => n.id === openId) ?? null;

  // Repeat offenders: how many of each player's notes the check or an admin has flagged or taken down.
  const flagsBy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      if (n.flaggedAt || n.status === "flagged" || n.status === "rejected") counts.set(authorKey(n), (counts.get(authorKey(n)) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const columns: Column<Note>[] = [
    {
      id: "note",
      header: "Note",
      cell: (n) => <span className="line-clamp-2 max-w-md min-w-56 whitespace-normal">{n.body}</span>,
      csv: (n) => n.body,
    },
    {
      id: "author",
      header: "Player",
      cell: (n) => (
        <span className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-entry text-xs text-white">{initials(n.author.name)}</AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">{who(n)}</span>
            {n.author.handle && <span className="block text-xs text-muted-foreground">{n.author.name}</span>}
          </span>
        </span>
      ),
      sortValue: (n) => who(n),
      csv: (n) => who(n),
    },
    {
      id: "status",
      header: "Status",
      cell: (n) => (
        <span className="flex flex-wrap gap-1.5">
          <StatusBadge {...NOTE_STATUS[n.status]} />
          {n.urgent && n.status === "flagged" && <StatusBadge label="Urgent" tone="danger" hint="Matched self-harm: reach out to the player personally." />}
        </span>
      ),
      sortValue: (n) => n.status,
      csv: (n) => NOTE_STATUS[n.status].label,
    },
    {
      id: "flagged",
      header: "Flagged for",
      cell: (n) =>
        n.matches.length ? (
          <span className="block max-w-48 text-sm whitespace-normal">{flaggedFor(n).join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (n) => flaggedFor(n).join(", "),
      csv: (n) => flaggedFor(n).join("; "),
    },
    {
      id: "posted",
      header: "Posted",
      cell: (n) => <span className="whitespace-nowrap">{formatDateTime(n.postedAt)}</span>,
      sortValue: (n) => n.postedAt,
      csv: (n) => n.postedAt,
    },
    {
      id: "likes",
      header: "Likes",
      cell: (n) => <span className="tabular">{n.status === "approved" || n.status === "pending" ? formatCount(n.likes) : "—"}</span>,
      sortValue: (n) => n.likes,
      csv: (n) => n.likes,
    },
    {
      id: "moderated",
      header: "Moderated by",
      cell: (n) =>
        n.moderatedBy ? (
          <span className="whitespace-nowrap">
            {n.moderatedBy}
            {n.moderatedAt && <span className="block text-xs text-muted-foreground">{formatDateTime(n.moderatedAt)}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (n) => n.moderatedAt ?? "",
      csv: (n) => n.moderatedBy ?? "",
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (n) => <RowActions n={n} onView={() => setOpenId(n.id)} /> },
  ];

  const filters: Filter<Note>[] = [
    { id: "status", label: "Status", options: Object.entries(NOTE_STATUS).map(([value, s]) => ({ value, label: s.label })), predicate: (n, v) => n.status === v },
  ];

  return (
    <>
      <DataTable
        rows={notes}
        columns={columns}
        getRowId={(n) => n.id}
        onRowClick={(n) => setOpenId(n.id)}
        searchText={(n) => `${n.body} ${n.author.handle ?? ""} ${n.author.name} ${flaggedFor(n).join(" ")}`}
        searchPlaceholder="Search notes, players or rules…"
        filters={filters}
        exportName="notes"
        exportTitle="Community Wall notes"
        empty={{ icon: StickyNote, title: "No notes yet", description: "Notes players post on the Community Wall appear here." }}
      />
      {/* The API's count when it sends one; otherwise counted from this list. */}
      <NoteSheet note={open} pastFlags={open ? (open.pastFlags ?? flagsBy.get(authorKey(open)) ?? 0) : 0} onClose={() => setOpenId(null)} />
    </>
  );
}
