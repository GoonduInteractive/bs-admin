"use client";

import { Check, MoreHorizontal, StickyNote, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCount, formatDateTime, initials } from "@/lib/format";
import { NOTE_STATUS } from "@/lib/labels";
import type { Note } from "@/types";
import { moderateNoteAction } from "./actions";

/** "@handle", or the player's name when they have no username yet. */
const who = (n: Note) => (n.author.handle ? `@${n.author.handle}` : n.author.name);

/**
 * Approve or reject one note. Both go straight through: each undoes the other.
 */
function useModerate(n: Note) {
  const [pending, start] = useTransition();

  const moderate = (status: "approved" | "rejected") =>
    start(async () => {
      const res = await moderateNoteAction(n.id, status);
      if ("error" in res) toast.error(res.error);
      else toast.success(status === "approved" ? `Approved: ${who(n)}'s note is on the wall` : `Rejected: ${who(n)}'s note is off the wall`);
    });
  return {
    pending,
    approve: () => moderate("approved"),
    reject: () => moderate("rejected"),
  };
}

/** The queue's two calls sit on the row; everything else is in the menu. */
function RowActions({ n, onView }: { n: Note; onView: () => void }) {
  const { pending, approve, reject } = useModerate(n);
  return (
    <div className="flex items-center justify-end gap-1">
      {/* Icons, so both calls and the menu fit beside six columns; each names itself on hover and to a screen reader. */}
      {n.status === "pending" && (
        <>
          <Button
            size="icon-sm"
            variant="outline"
            className="bg-card text-moss hover:bg-moss-soft hover:text-moss"
            disabled={pending}
            onClick={approve}
            aria-label={`Approve ${who(n)}'s note`}
            title="Approve"
          >
            <Check />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="bg-card text-flare hover:bg-flare-soft hover:text-flare"
            disabled={pending}
            onClick={reject}
            aria-label={`Reject ${who(n)}'s note`}
            title="Reject"
          >
            <X />
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`More actions for ${who(n)}'s note`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onView}>View note</DropdownMenuItem>
          {n.status === "rejected" && (
            <DropdownMenuItem onClick={approve}>
              <Check />
              Approve
            </DropdownMenuItem>
          )}
          {n.status === "approved" && (
            <DropdownMenuItem onClick={reject}>
              <X />
              Take off the wall
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NoteSheet({ note, onClose }: { note: Note | null; onClose: () => void }) {
  return (
    <Sheet open={!!note} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">{note && <NoteDetail n={note} />}</SheetContent>
    </Sheet>
  );
}

function NoteDetail({ n }: { n: Note }) {
  const { pending, approve, reject } = useModerate(n);
  const facts = (
    [
      ["Posted", formatDateTime(n.postedAt)],
      ["Likes", n.status === "approved" ? formatCount(n.likes) : "—"],
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
            <StatusBadge {...NOTE_STATUS[n.status]} className="mt-1.5" />
          </div>
        </div>
      </SheetHeader>
      <div className="space-y-5 overflow-y-auto p-6">
        {/* The note as written: what goes on the wall, word for word. */}
        <blockquote className="rounded-lg bg-paper p-4 text-base leading-relaxed whitespace-pre-line">{n.body}</blockquote>
        <dl className="divide-y text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2">
          {n.status !== "approved" && (
            <Button size="xl" disabled={pending} onClick={approve}>
              <Check />
              Approve
            </Button>
          )}
          {n.status !== "rejected" && (
            <Button variant="outline" size="xl" disabled={pending} onClick={reject}>
              <X />
              {n.status === "approved" ? "Take off the wall" : "Reject"}
            </Button>
          )}
          <Button variant="outline" size="xl" render={<Link href={`/players?q=${encodeURIComponent(n.author.handle ?? n.author.name)}`} />}>
            View player
          </Button>
        </div>
      </div>
    </>
  );
}

export function NotesTable({ notes }: { notes: Note[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = notes.find((n) => n.id === openId) ?? null;

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
    { id: "status", header: "Status", cell: (n) => <StatusBadge {...NOTE_STATUS[n.status]} />, sortValue: (n) => n.status, csv: (n) => NOTE_STATUS[n.status].label },
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
      cell: (n) => <span className="tabular">{n.status === "approved" ? formatCount(n.likes) : "—"}</span>,
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
        searchText={(n) => `${n.body} ${n.author.handle ?? ""} ${n.author.name}`}
        searchPlaceholder="Search notes or players…"
        filters={filters}
        exportName="notes"
        exportTitle="Community Wall notes"
        empty={{ icon: StickyNote, title: "No notes yet", description: "Notes players post on the Community Wall appear here." }}
      />
      <NoteSheet note={open} onClose={() => setOpenId(null)} />
    </>
  );
}
