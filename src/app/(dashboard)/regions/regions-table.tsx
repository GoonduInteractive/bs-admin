"use client";

import { MapPin, MoreHorizontal, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatCount, formatDate } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import type { Region } from "@/types";
import { deleteRegionAction, saveRegionAction, setRegionStatusAction } from "./actions";

/** A region with how many players and tournaments use it. */
export type RegionRow = Region & { players: number; tournaments: number };

const STATUS: Record<Region["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

/** Add a region, or rename one. One dialog for both; `region` present means renaming. */
function RegionDialog({ open, onOpenChange, region }: { open: boolean; onOpenChange: (o: boolean) => void; region?: RegionRow }) {
  const [name, setName] = useState(region?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveRegionAction(region?.id ?? null, { name });
      if ("error" in res) return setError(res.error ?? "Check the name");
      toast.success(region ? `Renamed to ${res.region.name}` : `${res.region.name} added`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(region?.name ?? "");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{region ? `Rename ${region.name}` : "Add a region"}</DialogTitle>
            <DialogDescription>
              {region
                ? `The new name shows everywhere at once. Its ${formatCount(region.players)} players and ${formatCount(region.tournaments)} tournaments stay in it.`
                : "New regions are offered to players at registration straight away."}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="region-name">Name</FieldLabel>
            <Input
              id="region-name"
              autoFocus
              maxLength={40}
              value={name}
              placeholder="Kano"
              className="h-10"
              aria-invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <FieldDescription>As players will see it, e.g. a state, city or country.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {region ? "Save name" : "Add region"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowMenu({ row }: { row: RegionRow }) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const archived = row.status === "archived";
  const used = row.players + row.tournaments > 0;

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast.error(res.error);
      else toast.success(done);
    });

  return (
    <div className="flex justify-end">
      {/* Beside the menu, not in it: the menu closes when an item is clicked. */}
      <RegionDialog open={renaming} onOpenChange={setRenaming} region={row} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${row.name}?`}
        description="No player or tournament uses it, so nothing else changes. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => run(() => deleteRegionAction(row.id), `${row.name} deleted`)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                () => setRegionStatusAction(row.id, archived ? "active" : "archived"),
                archived ? `${row.name} is offered at registration again` : `${row.name} archived`,
              )
            }
          >
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* In use, it can only be archived: deleting would leave players with no region. */}
          <DropdownMenuItem variant="destructive" disabled={used} onClick={() => setDeleting(true)}>
            {used ? "In use: archive instead" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const columns: Column<RegionRow>[] = [
  {
    id: "name",
    header: "Region",
    cell: (r) => (
      <span className="flex items-center gap-2 font-medium">
        <MapPin className="size-4 text-muted-foreground" />
        {r.name}
      </span>
    ),
    sortValue: (r) => r.name,
    csv: (r) => r.name,
  },
  { id: "players", header: "Players", cell: (r) => <span className="tabular">{formatCount(r.players)}</span>, sortValue: (r) => r.players, csv: (r) => r.players },
  {
    id: "tournaments",
    header: "Tournaments",
    cell: (r) => <span className="tabular">{formatCount(r.tournaments)}</span>,
    sortValue: (r) => r.tournaments,
    csv: (r) => r.tournaments,
  },
  { id: "status", header: "Status", cell: (r) => <StatusBadge {...STATUS[r.status]} />, csv: (r) => STATUS[r.status].label },
  { id: "created", header: "Added", cell: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>, sortValue: (r) => r.createdAt, csv: (r) => r.createdAt },
  { id: "actions", header: <span className="sr-only">Actions</span>, cell: (r) => <RowMenu row={r} />, className: "w-12" },
];

const filters: Filter<RegionRow>[] = [
  {
    id: "status",
    label: "Status",
    options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (r, v) => r.status === v,
  },
];

export function RegionsTable({ rows }: { rows: RegionRow[] }) {
  const [adding, setAdding] = useState(false);
  const add = (
    <Button onClick={() => setAdding(true)}>
      <Plus />
      Add region
    </Button>
  );

  return (
    <>
      <RegionDialog open={adding} onOpenChange={setAdding} />
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchText={(r) => r.name}
        searchPlaceholder="Search regions…"
        filters={filters}
        toolbar={add}
        exportName="regions"
        exportTitle="Regions"
        empty={{ icon: MapPin, title: "No regions yet", description: "Add the first region players can pick at registration.", action: add }}
      />
    </>
  );
}
